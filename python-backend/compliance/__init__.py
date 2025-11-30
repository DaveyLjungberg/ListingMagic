"""
Fair Housing Compliance Module for Listing Magic

Ensures all AI-generated content complies with the Federal Fair Housing Act.
Protected classes: Race, Color, Religion, Sex/Gender, Handicap/Disability,
Familial Status, National Origin.

Golden Rule: "Describe the Property - NOT the People"
"""

from .fair_housing import (
    check_fair_housing_compliance,
    get_compliance_system_prompt,
    PROHIBITED_PATTERNS,
    ComplianceResult,
    ComplianceViolation,
)

__all__ = [
    "check_fair_housing_compliance",
    "get_compliance_system_prompt",
    "PROHIBITED_PATTERNS",
    "ComplianceResult",
    "ComplianceViolation",
]
