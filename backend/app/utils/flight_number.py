import re
from typing import Optional, Tuple
from sqlalchemy import or_, and_

def normalize_flight_query(query: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse flight queries of all shapes and sizes:
    - BJ640, LBT640 (standard IATA/ICAO)
    - BJ 640, LBT 640 (with spaces)
    - bj640, lbt640 (lowercase)
    - 640 (numeric suffix only)
    - BJ, LBT (carrier prefix only)
    
    Returns (prefix, numeric_part).
    """
    if not query:
        return None, None
        
    # Standardize whitespace and casing
    q = re.sub(r"\s+", "", query).upper()
    
    # 1. Alphanumeric split (e.g. BJ640 -> prefix="BJ", num="640")
    match = re.match(r"^([A-Z]+)([0-9]+)$", q)
    if match:
        return match.group(1), match.group(2)
        
    # 2. Suffix numeric-only (e.g. 640 -> prefix=None, num="640")
    match_num = re.match(r"^([0-9]+)$", q)
    if match_num:
        return None, match_num.group(1)
        
    # 3. Carrier-prefix only (e.g. BJ -> prefix="BJ", num=None)
    match_alpha = re.match(r"^([A-Z]+)$", q)
    if match_alpha:
        return match_alpha.group(1), None
        
    return None, None


def get_flight_alias_filter(model_cls, query_str: str):
    """
    Returns an OR-wrapped SQLAlchemy filter expression for searching flight models
    by flight_number, airline_iata, or airline_icao using parsed alias components.
    
    Compatible with both AEFlightSnapshot and AEFlightDataset.
    """
    prefix, num = normalize_flight_query(query_str)
    
    if not prefix and not num:
        # Fallback to general fuzzy search if pattern doesn't match standard identifiers
        return model_cls.flight_number.ilike(f"%{query_str}%")
        
    clauses = []
    
    # 1. Direct match on cleaned/capitalized query
    clean_q = re.sub(r"\s+", "", query_str).upper()
    clauses.append(model_cls.flight_number == clean_q)
    
    # 2. Intelligent dynamic routing based on components
    if prefix and num:
        clauses.append(
            and_(
                model_cls.flight_number.like(f"%{num}"),
                or_(
                    model_cls.airline_iata == prefix,
                    model_cls.airline_icao == prefix
                )
            )
        )
    elif num:
        # Match any flight that ends with the requested number suffix
        clauses.append(model_cls.flight_number.like(f"%{num}"))
    elif prefix:
        # Match carrier codes or flight number start prefix
        clauses.append(
            or_(
                model_cls.airline_iata == prefix,
                model_cls.airline_icao == prefix,
                model_cls.flight_number.like(f"{prefix}%")
            )
        )
        
    return or_(*clauses)
