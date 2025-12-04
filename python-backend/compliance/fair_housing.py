"""
Fair Housing Compliance Checker

Validates real estate content against Federal Fair Housing Act requirements.
Violations can result in fines of $16,000+ per violation.

Protected Classes:
- Race
- Color
- Religion
- Sex/Gender
- Handicap/Disability
- Familial Status (children)
- National Origin
"""

import re
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class ComplianceViolation:
    """Represents a single Fair Housing compliance violation."""
    category: str
    matches: List[str]
    severity: str  # "high" or "medium"
    suggestion: str


@dataclass
class ComplianceResult:
    """Result of a Fair Housing compliance check."""
    is_compliant: bool
    violations: List[ComplianceViolation]
    message: str


# Prohibited patterns organized by protected class
PROHIBITED_PATTERNS = {
    "familial_status": {
        "patterns": [
            r"\b(adults?\s+only)\b",
            r"\b(no\s+children)\b",
            r"\b(no\s+kids)\b",
            r"\b(perfect\s+for\s+couples?)\b",
            r"\b(ideal\s+for\s+couples?)\b",
            r"\b(great\s+for\s+couples?)\b",
            r"\b(mature\s+(individual|person|couple|adult)s?)\b",
            r"\b(empty\s+nesters?)\b",
            r"\b(singles?\s+only)\b",
            r"\b(adult\s+(community|living|building|complex))\b",
            r"\b(great\s+for\s+famil(y|ies))\b",
            r"\b(perfect\s+for\s+famil(y|ies))\b",
            r"\b(ideal\s+for\s+famil(y|ies))\b",
            r"\b(growing\s+famil(y|ies))\b",
            r"\b(young\s+famil(y|ies))\b",
            r"\b(married\s+couples?)\b",
            r"\b(newlyweds?)\b",
        ],
        "severity": "high",
        "suggestion": "Describe the property features instead (e.g., '4 bedrooms' rather than 'perfect for families')"
    },
    "religion": {
        "patterns": [
            r"\b(near\s+(church(es)?|synagogue|temple|mosque))\b",
            r"\b(close\s+to\s+(church(es)?|synagogue|temple|mosque))\b",
            r"\b(walking\s+distance\s+to\s+(church|synagogue|temple|mosque))\b",
            r"\b(christian\s+(community|neighborhood|area))\b",
            r"\b(jewish\s+(community|neighborhood|area))\b",
            r"\b(catholic\s+(community|neighborhood|area))\b",
            r"\b(muslim\s+(community|neighborhood|area))\b",
            r"\b(religious\s+(community|neighborhood))\b",
        ],
        "severity": "high",
        "suggestion": "Remove religious references. Focus on nearby amenities like parks, shops, transit."
    },
    "race_ethnicity": {
        "patterns": [
            r"\b(white\s+(community|neighborhood|area))\b",
            r"\b(black\s+(community|neighborhood|area))\b",
            r"\b(asian\s+(community|neighborhood|area))\b",
            r"\b(hispanic\s+(community|neighborhood|area))\b",
            r"\b(latino\s+(community|neighborhood|area))\b",
            r"\b(caucasian)\b",
            r"\b(african[\s-]american\s+(community|neighborhood|area))\b",
            r"\b(integrated\s+(community|neighborhood|area))\b",
            r"\b(diverse\s+(community|neighborhood|area))\b",
            r"\b(ethnic\s+(community|neighborhood|area|enclave))\b",
            r"\b(exclusively\s+\w+\s+neighborhood)\b",
        ],
        "severity": "high",
        "suggestion": "Remove all racial/ethnic references. Describe property features and amenities only."
    },
    "disability": {
        "patterns": [
            r"\b(no\s+wheelchairs?)\b",
            r"\b(able[\s-]bodied)\b",
            r"\b(healthy\s+only)\b",
            r"\b(no\s+disabled)\b",
            r"\b(not\s+suitable\s+for\s+disabled)\b",
            r"\b(not\s+handicap(ped)?\s+accessible)\b",
            r"\b(physically\s+fit)\b",
            r"\b(mentally\s+stable)\b",
        ],
        "severity": "high",
        "suggestion": "Remove disability references. You may describe accessibility features positively (e.g., 'wheelchair ramp', 'elevator access')."
    },
    "gender": {
        "patterns": [
            r"\b(male\s+only)\b",
            r"\b(female\s+only)\b",
            r"\b(males?\s+preferred)\b",
            r"\b(females?\s+preferred)\b",
            r"\b(bachelor\s+(pad|apartment|living))\b",
            r"\b(gentleman('s)?\s+(apartment|residence|quarters))\b",
            r"\b(lad(y|ies)\s+only)\b",
            r"\b(women\s+only)\b",
            r"\b(men\s+only)\b",
        ],
        "severity": "high",
        "suggestion": "Remove gender preferences. Housing must be available equally to all."
    },
    "age": {
        "patterns": [
            r"\b(senior(s)?\s+(only|preferred|community|living))\b",
            r"\b(older\s+persons?\s+(only|preferred))\b",
            r"\b(retirees?\s+(only|preferred|community))\b",
            r"\b(golden\s+age)\b",
            r"\b(young\s+professionals?\s+only)\b",
            r"\b(millennials?\s+only)\b",
            r"\b(no\s+seniors?)\b",
            r"\b(age\s+\d+\s*\+?\s+only)\b",
        ],
        "severity": "high",
        "suggestion": "Remove age references unless this is a verified 55+ community with legal exemption."
    },
    "national_origin": {
        "patterns": [
            r"\b(american\s+only)\b",
            r"\b(citizens?\s+only)\b",
            r"\b(no\s+immigrants?)\b",
            r"\b(english\s+speakers?\s+only)\b",
            r"\b(must\s+speak\s+english)\b",
            r"\b(foreigners?\s+(not\s+allowed|prohibited))\b",
        ],
        "severity": "high",
        "suggestion": "Remove national origin references. Housing must be available to all regardless of origin."
    },
}


def check_fair_housing_compliance(text: str) -> ComplianceResult:
    """
    Check text for Fair Housing Act violations.

    Args:
        text: The content to check

    Returns:
        ComplianceResult with is_compliant flag and any violations found
    """
    if not text:
        return ComplianceResult(
            is_compliant=True,
            violations=[],
            message="No content to check"
        )

    violations = []
    text_lower = text.lower()

    for category, config in PROHIBITED_PATTERNS.items():
        category_matches = []

        for pattern in config["patterns"]:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            if matches:
                # Flatten tuples from regex groups
                for match in matches:
                    if isinstance(match, tuple):
                        category_matches.append(match[0])
                    else:
                        category_matches.append(match)

        if category_matches:
            # Remove duplicates while preserving order
            unique_matches = list(dict.fromkeys(category_matches))
            violations.append(ComplianceViolation(
                category=category,
                matches=unique_matches,
                severity=config["severity"],
                suggestion=config["suggestion"]
            ))

    if violations:
        categories = [v.category.replace("_", " ").title() for v in violations]
        message = f"Fair Housing violations detected in: {', '.join(categories)}. Please revise content to describe the property, not potential residents."
    else:
        message = "Content is Fair Housing compliant"

    return ComplianceResult(
        is_compliant=len(violations) == 0,
        violations=violations,
        message=message
    )


def get_compliance_system_prompt(content_type: str = "general") -> str:
    """
    Get the Fair Housing compliance instructions to include in AI prompts.

    Args:
        content_type: One of "remarks", "features", "script", or "general"

    Returns:
        System prompt text with compliance instructions
    """
    base_compliance = """
CRITICAL FAIR HOUSING COMPLIANCE RULES:
You are generating real estate marketing content that MUST comply with the Federal Fair Housing Act.
Violations can result in fines of $16,000+ per violation.

PROTECTED CLASSES - NEVER REFERENCE:
- Race or Color
- Religion
- Sex/Gender
- Handicap/Disability
- Familial Status (children, families)
- National Origin
- Age (unless verified 55+ housing)

ABSOLUTE PROHIBITIONS - NEVER USE:
1. BUYER-SPECIFIC PHRASES:
   - "perfect for families/couples", "ideal for", "great for"
   - "adults only", "no children"
   - "senior living", "retirees welcome"
   - Any racial, ethnic, religious, or nationality references

2. IMPERATIVE/INVITATIONAL LANGUAGE:
   - "Welcome to", "Step inside", "Come see", "Enter through"
   - "Walk into", "Imagine yourself", "Picture yourself"
   - "Don't miss", "Must see", "Won't last"
   - Any imperative commands addressing the reader

3. SECOND PERSON PRONOUNS:
   - "you", "your", "you'll", "yourself"
   - Any direct address to the reader

4. RELIGIOUS LOCATION REFERENCES:
   - "near church/synagogue/temple/mosque"
   - "walking distance to worship"

GOLDEN RULE: Describe the PROPERTY in third person, NOT the PEOPLE or the reader.

REQUIRED LANGUAGE STYLE:
- Third person, purely descriptive ("This residence features...")
- Present tense factual statements
- Objective descriptions of features, materials, finishes
- Neutral, professional tone

ACCEPTABLE DESCRIPTIONS:
- "primary suite", "family room" (architectural terms)
- "guest suite" (property feature, not "mother-in-law suite")
- "near schools", "near parks" (location features)
- "quiet street", "cul-de-sac" (property descriptions)
- "spacious", "updated", "renovated" (property qualities)

Example WRONG: "Welcome to this stunning home! Step inside and you'll love the open floor plan. Perfect for families!"
Example CORRECT: "This residence features an open floor plan with hardwood floors throughout. The main living area includes large windows providing natural light."

If a user requests content that would violate Fair Housing rules, politely decline
and suggest compliant alternatives.
"""

    if content_type == "remarks":
        return f"""{base_compliance}

CONTENT TYPE: Public MLS Remarks
- Keep remarks between 150-300 words
- Use ONLY third-person, descriptive language
- NEVER use "Welcome", "Step inside", "you/your", or imperative commands
- Open with a factual statement about the property ("This residence features...")
- Highlight property features using objective descriptions
- Focus on rooms, architecture, materials, finishes
- End with factual property information, NOT a call to action
"""

    elif content_type == "features":
        return f"""{base_compliance}

CONTENT TYPE: Property Features List
- Organize by room/area
- List specific features and upgrades
- Be factual and comprehensive
- Use bullet points for clarity
- Describe physical attributes only
- NEVER suggest who should live there
"""

    elif content_type == "script":
        return f"""{base_compliance}

CONTENT TYPE: Walk-through Video Script
- Use section markers: [EXTERIOR], [ENTRY], [LIVING], etc.
- Use ONLY third-person, descriptive language throughout
- NEVER use "Welcome", "Step inside", "you/your", or imperative commands
- NEVER say "Let me show you" or similar invitations
- Describe spaces factually: "The kitchen features..." "The primary suite includes..."
- Use neutral transitions: "Moving to the kitchen..." "The outdoor area features..."
- Keep 100-200 words per section
- Describe physical features ONLY, not feelings or experiences
"""

    else:
        return base_compliance


def sanitize_content(text: str) -> str:
    """
    Attempt to automatically sanitize content by removing obvious violations.
    Note: This is a fallback - AI should generate compliant content from the start.

    Args:
        text: Content to sanitize

    Returns:
        Sanitized content with violations removed
    """
    result = text

    # Simple replacements for common violations
    replacements = {
        r"\bperfect for (families|couples)\b": "ideal layout",
        r"\bgreat for (families|couples)\b": "spacious design",
        r"\bideal for (families|couples)\b": "versatile floor plan",
        r"\badults only\b": "",
        r"\bno children\b": "",
        r"\bnear church\b": "convenient location",
        r"\bnear synagogue\b": "convenient location",
        r"\bnear temple\b": "convenient location",
        r"\bnear mosque\b": "convenient location",
    }

    for pattern, replacement in replacements.items():
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

    # Clean up any double spaces
    result = re.sub(r'\s+', ' ', result).strip()

    return result
