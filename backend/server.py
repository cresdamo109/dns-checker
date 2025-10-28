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
import ipaddress


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
    is_listed: bool
    response_ips: List[str]
    error: Optional[str] = None

class DNSQueryResponse(BaseModel):
    query_ip: str
    reversed_ip: str
    ip_version: str
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

def reverse_ipv4(ip: str) -> str:
    """
    Reverse an IPv4 address for DNSBL lookup
    Example: 192.168.1.1 -> 1.1.168.192
    """
    parts = ip.split('.')
    return '.'.join(reversed(parts))

def reverse_ipv6(ip: str) -> str:
    """
    Reverse an IPv6 address for DNSBL lookup
    Example: 2001:db8::1 -> 1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2
    """
    # Parse and expand the IPv6 address to full form
    addr = ipaddress.IPv6Address(ip)
    # Get the expanded hex string without colons
    expanded = addr.exploded.replace(':', '')
    # Reverse each nibble (hex digit) and join with dots
    reversed_nibbles = '.'.join(reversed(expanded))
    return reversed_nibbles

def query_dnsbl(reversed_ip: str, domain: str) -> DNSQueryResult:
    """
    Query DNSBL to check if IP is listed
    """
    query_domain = f"{reversed_ip}.{domain}"
    
    try:
        # Query A records for the reversed IP + blacklist domain
        resolver = dns.resolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 5
        
        answers = resolver.resolve(query_domain, 'A')
        response_ips = [str(rdata) for rdata in answers]
        
        return DNSQueryResult(
            domain=domain,
            is_listed=True,
            response_ips=response_ips,
            error=None
        )
    except dns.resolver.NXDOMAIN:
        # NXDOMAIN means the IP is NOT listed (which is good)
        return DNSQueryResult(
            domain=domain,
            is_listed=False,
            response_ips=[],
            error=None
        )
    except dns.resolver.NoAnswer:
        return DNSQueryResult(
            domain=domain,
            is_listed=False,
            response_ips=[],
            error="No answer from DNS server"
        )
    except dns.resolver.Timeout:
        return DNSQueryResult(
            domain=domain,
            is_listed=False,
            response_ips=[],
            error="Query timeout"
        )
    except Exception as e:
        return DNSQueryResult(
            domain=domain,
            is_listed=False,
            response_ips=[],
            error=f"Error: {str(e)}"
        )

@api_router.post("/dns-query", response_model=DNSQueryResponse)
async def dns_query(request: DNSQueryRequest):
    """
    Query DNSBL to check if an IP (IPv4 or IPv6) is listed
    """
    # Validate and determine IP version
    try:
        ip_obj = ipaddress.ip_address(request.ip)
        if isinstance(ip_obj, ipaddress.IPv4Address):
            ip_version = "IPv4"
            reversed_ip = reverse_ipv4(request.ip)
        else:
            ip_version = "IPv6"
            reversed_ip = reverse_ipv6(request.ip)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address format")
    
    domains = [
        "wl.none.hjrp-server.com",
        "wl.med.hjrp-server.com",
        "wl.hi.hjrp-server.com",
        "bl.hjrp-server.com"
    ]
    
    # Run DNSBL queries in parallel
    loop = asyncio.get_event_loop()
    tasks = [loop.run_in_executor(None, query_dnsbl, reversed_ip, domain) for domain in domains]
    results = await asyncio.gather(*tasks)
    
    return DNSQueryResponse(
        query_ip=request.ip,
        reversed_ip=reversed_ip,
        ip_version=ip_version,
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
