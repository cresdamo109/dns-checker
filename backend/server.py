from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import dns.resolver
import asyncio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class DNSQueryRequest(BaseModel):
    ip: str

class DNSQueryResult(BaseModel):
    domain: str
    ip_addresses: List[str]
    error: Optional[str] = None

class DNSQueryResponse(BaseModel):
    query_ip: str
    results: List[DNSQueryResult]

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "DNS Query Service"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

def query_dns(domain: str, query_ip: str) -> DNSQueryResult:
    """
    Query DNS A records for a domain with the provided IP
    """
    try:
        # Create a custom resolver
        resolver = dns.resolver.Resolver()
        resolver.nameservers = [query_ip]  # Use the provided IP as DNS server
        resolver.timeout = 5
        resolver.lifetime = 5
        
        # Query A records
        answers = resolver.resolve(domain, 'A')
        ip_addresses = [str(rdata) for rdata in answers]
        
        return DNSQueryResult(
            domain=domain,
            ip_addresses=ip_addresses,
            error=None
        )
    except dns.resolver.NoAnswer:
        return DNSQueryResult(
            domain=domain,
            ip_addresses=[],
            error="No A records found"
        )
    except dns.resolver.NXDOMAIN:
        return DNSQueryResult(
            domain=domain,
            ip_addresses=[],
            error="Domain does not exist"
        )
    except dns.resolver.Timeout:
        return DNSQueryResult(
            domain=domain,
            ip_addresses=[],
            error="Query timeout"
        )
    except Exception as e:
        return DNSQueryResult(
            domain=domain,
            ip_addresses=[],
            error=f"Error: {str(e)}"
        )

@api_router.post("/dns-query", response_model=DNSQueryResponse)
async def dns_query(request: DNSQueryRequest):
    """
    Query DNS A records for multiple domains using the provided IP as DNS server
    """
    domains = [
        "wl.none.hjrp-server.com",
        "wl.med.hjrp-server.com",
        "wl.hi.hjrp-server.com",
        "bl.hjrp-server.com"
    ]
    
    # Run DNS queries in parallel
    loop = asyncio.get_event_loop()
    tasks = [loop.run_in_executor(None, query_dns, domain, request.ip) for domain in domains]
    results = await asyncio.gather(*tasks)
    
    return DNSQueryResponse(
        query_ip=request.ip,
        results=results
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
