"""
Listing Magic - Prompt Templates

Optimized prompts for each AI model and task.
Each prompt is tailored to the model's strengths.
"""

from typing import Optional, List, Dict, Any


# =============================================================================
# System Prompts
# =============================================================================

SYSTEM_PROMPT_REALTOR = """You are an expert real estate professional with 20+ years of experience in luxury property marketing. You have a deep understanding of what makes listings compelling and what features buyers value most. Your writing is professional yet warm, persuasive but never pushy, and always highlights the unique aspects of each property."""

SYSTEM_PROMPT_VIDEO_HOST = """You are a warm, engaging real estate video host known for creating personal, conversational property tours. Your narration style makes viewers feel like they're getting a private showing from a trusted friend who happens to be a real estate expert. You speak naturally, with genuine enthusiasm, and have an excellent sense of pacing and timing."""

SYSTEM_PROMPT_DATA_ANALYST = """You are a real estate data specialist who excels at extracting and organizing property information into structured formats. You are meticulous about accuracy, understand MLS data standards, and always provide comprehensive, well-categorized information."""


# =============================================================================
# GPT-4.1 Vision Prompts
# =============================================================================

PUBLIC_REMARKS_SYSTEM = """You are an expert real estate copywriter who creates compelling MLS listing descriptions. You excel at:
- Analyzing property photos to identify key features and selling points
- Writing persuasive, professional marketing copy
- Highlighting unique features that differentiate properties
- Creating emotional connections with potential buyers
- Following MLS guidelines (no ALL CAPS, proper formatting)

Always write in present tense and third person. Be specific rather than generic."""

PUBLIC_REMARKS_PROMPT = """Analyze the provided property photos and create a compelling MLS listing description.

**Property Details:**
- Address: {address}
- Bedrooms: {bedrooms}
- Bathrooms: {bathrooms}
- Square Feet: {square_feet}
- Year Built: {year_built}
- Property Type: {property_type}

**Instructions:**
1. First, analyze all photos to identify:
   - Room count and layout
   - Kitchen features (countertops, appliances, cabinetry)
   - Flooring types throughout
   - Special architectural features
   - Outdoor spaces and landscaping
   - Overall condition and style
   - Any notable upgrades or premium finishes

2. Then write a {max_words}-word MLS listing description that:
   - Opens with an attention-grabbing first sentence
   - Highlights the 3-5 most compelling features visible in the photos
   - Uses specific details (e.g., "granite countertops" not just "updated kitchen")
   - Creates a sense of lifestyle and possibility
   - Maintains a professional yet warm tone
   - Ends with a call to action
   - Avoids clichés like "must see" or "won't last"

{additional_instructions}

Write ONLY the listing description text. Do not include any headers, labels, or meta-commentary."""


PHOTO_ANALYSIS_PROMPT = """Analyze these property photos and extract detailed information about the home.

For each category, list what you can observe in the photos:

1. **Rooms & Layout**
   - Number of bedrooms visible
   - Number of bathrooms visible
   - Other rooms (office, bonus room, etc.)

2. **Kitchen**
   - Countertop material
   - Cabinet style and finish
   - Appliances visible
   - Island or breakfast bar
   - Special features

3. **Flooring**
   - Types in each area (hardwood, tile, carpet, LVP)
   - Condition

4. **Interior Features**
   - Ceiling type and height
   - Crown molding or trim
   - Fireplace
   - Built-ins
   - Lighting fixtures

5. **Windows & Doors**
   - Window style and size
   - Natural light quality
   - Any special doors (French, sliding glass)

6. **Bathrooms**
   - Vanity style
   - Shower/tub type
   - Tile work
   - Special features

7. **Outdoor Spaces**
   - Patio/deck
   - Pool or water features
   - Landscaping
   - Fencing
   - Garage

8. **Overall Assessment**
   - Architectural style
   - Condition (Excellent/Good/Fair/Needs Work)
   - Notable upgrades
   - Quality level

Respond with a JSON object containing your analysis with confidence scores (0.0-1.0) for each major finding."""


# =============================================================================
# Claude Sonnet 4.5 Prompts
# =============================================================================

WALKTHRU_SCRIPT_SYSTEM = """You are a warm, personable real estate agent giving a video tour of a property. Your narration style is:
- Conversational and natural, like talking to a friend
- Enthusiastic but genuine, never salesy
- Well-paced for video (about 150 words per minute)
- Descriptive and evocative, helping viewers visualize spaces
- Focused on how spaces feel and how buyers might use them

You naturally guide viewers through the home, using smooth transitions between rooms."""

WALKTHRU_SCRIPT_PROMPT = """Create a video walk-through narration script for this property.

**Property Information:**
- Address: {address}
- Bedrooms: {bedrooms}
- Bathrooms: {bathrooms}
- Square Feet: {square_feet}
- Key Features: {features}

**Existing Listing Description (for context):**
{public_remarks}

**Script Requirements:**
- Target length: {target_words} words (approximately {duration_seconds} seconds when spoken)
- Style: {style} and engaging
- Include natural pauses indicated with "..."

**Structure:**
1. **INTRO** (15-20 seconds)
   - Warm welcome
   - Address and first impression
   - Set the tone

2. **ENTRY & LIVING AREAS** (20-30 seconds)
   - First impressions inside
   - Flow and layout
   - Key features

3. **KITCHEN** (20-30 seconds)
   - Highlight main features
   - Describe the cooking/gathering experience

4. **PRIMARY SUITE** (15-20 seconds)
   - Bedroom highlights
   - Bathroom features

5. **ADDITIONAL SPACES** (15-20 seconds)
   - Other bedrooms
   - Bonus rooms or offices

6. **OUTDOOR** (15-20 seconds)
   - Backyard/patio
   - Landscaping

7. **CLOSING** (10-15 seconds)
   - Summarize key points
   - Call to action

**Style Guidelines:**
- Use "you" and "your" to speak directly to viewers
- Describe feelings and experiences, not just features
- Include natural transitions like "Let me show you...", "Now stepping into..."
- Vary sentence length for natural rhythm
- Show genuine enthusiasm without being over-the-top

Write the complete narration script with section markers [INTRO], [LIVING], etc."""


# =============================================================================
# Gemini 3 Pro Prompts
# =============================================================================

FEATURES_SYSTEM = """You are a real estate data specialist who excels at identifying and categorizing property features. You provide accurate, comprehensive feature lists that are compatible with MLS systems. You are thorough and organized, always grouping features logically."""

FEATURES_PROMPT = """Analyze the property information and photos to create a comprehensive features list.

**Property Details:**
- Address: {address}
- Property Type: {property_type}
- Bedrooms: {bedrooms}
- Bathrooms: {bathrooms}
- Square Feet: {square_feet}
- Year Built: {year_built}

**Instructions:**
Extract all identifiable features and organize them into these categories:

1. **Interior Features**
   - Flooring types
   - Ceiling features
   - Fireplace details
   - Built-ins and storage
   - Lighting

2. **Kitchen**
   - Countertops
   - Cabinets
   - Appliances
   - Special features (island, pantry, etc.)

3. **Bathroom Features**
   - Primary bath features
   - Secondary bath features
   - Fixtures and finishes

4. **Bedroom Features**
   - Primary bedroom
   - Secondary bedrooms
   - Closet types

5. **Exterior & Outdoor**
   - Patio/deck
   - Landscaping
   - Fencing
   - Garage details
   - Pool/spa

6. **Systems & Utilities**
   - HVAC
   - Water heater
   - Electrical
   - Smart home features

7. **Energy Efficiency**
   - Windows
   - Insulation
   - Solar
   - Energy Star items

8. **Community/HOA**
   - Amenities
   - Rules/restrictions

**Output Format:**
Return a JSON object with this structure:
```json
{{
  "categories": [
    {{
      "name": "Category Name",
      "features": ["Feature 1", "Feature 2", ...]
    }}
  ],
  "all_features": ["Feature 1", "Feature 2", ...],
  "highlight_features": ["Top 5 most notable features"]
}}
```

Be specific (e.g., "Granite countertops" not "Nice counters"). Include measurements where visible. Maximum {max_features} total features."""


RESO_DATA_SYSTEM = """You are an MLS data specialist who creates RESO-compliant property data. You understand the RESO Data Dictionary standards and create accurate, complete listings that integrate seamlessly with MLS systems."""

RESO_DATA_PROMPT = """Generate a RESO Data Dictionary compliant JSON object for this property listing.

**Property Information:**
- Address: {address}
- Street: {street}
- City: {city}
- State: {state}
- ZIP: {zip_code}
- Property Type: {property_type}
- Bedrooms: {bedrooms}
- Bathrooms: {bathrooms}
- Square Feet: {square_feet}
- Year Built: {year_built}
- List Price: {price}

**Public Remarks:**
{public_remarks}

**Features List:**
{features}

**Required RESO Fields:**
Generate all standard RESO fields including:

1. **Identification**
   - ListingKey (generate unique ID)
   - ListingId
   - StandardStatus: "Active"

2. **Property Details**
   - PropertyType
   - PropertySubType
   - BedroomsTotal
   - BathroomsTotalInteger
   - BathroomsFull
   - BathroomsHalf
   - LivingArea
   - LotSizeArea

3. **Address**
   - UnparsedAddress
   - StreetNumber
   - StreetName
   - StreetSuffix
   - City
   - StateOrProvince
   - PostalCode
   - Country

4. **Features (as arrays)**
   - InteriorFeatures
   - ExteriorFeatures
   - Appliances
   - Flooring
   - Heating
   - Cooling
   - ParkingFeatures

5. **Dates**
   - OnMarketDate
   - ModificationTimestamp

6. **Listing Info**
   - PublicRemarks
   - ListPrice
   - OriginalListPrice

Return ONLY valid JSON matching RESO Data Dictionary v{schema_version} standards.
Use null for unknown values, never empty strings.
Ensure all field names match RESO specification exactly (PascalCase)."""


# =============================================================================
# Helper Functions
# =============================================================================

def format_public_remarks_prompt(
    address: str,
    bedrooms: Optional[int] = None,
    bathrooms: Optional[float] = None,
    square_feet: Optional[int] = None,
    year_built: Optional[int] = None,
    property_type: str = "Single Family",
    max_words: int = 250,
    highlight_features: Optional[List[str]] = None
) -> str:
    """Format the public remarks prompt with property details."""
    additional = ""
    if highlight_features:
        additional = f"\n**Features to emphasize:** {', '.join(highlight_features)}"

    return PUBLIC_REMARKS_PROMPT.format(
        address=address,
        bedrooms=bedrooms or "Unknown",
        bathrooms=bathrooms or "Unknown",
        square_feet=f"{square_feet:,}" if square_feet else "Unknown",
        year_built=year_built or "Unknown",
        property_type=property_type,
        max_words=max_words,
        additional_instructions=additional
    )


def format_walkthru_prompt(
    address: str,
    bedrooms: Optional[int] = None,
    bathrooms: Optional[float] = None,
    square_feet: Optional[int] = None,
    features: Optional[List[str]] = None,
    public_remarks: Optional[str] = None,
    duration_seconds: int = 90,
    style: str = "conversational"
) -> str:
    """Format the walk-thru script prompt."""
    target_words = int(duration_seconds * 2.5)  # ~150 words per minute

    return WALKTHRU_SCRIPT_PROMPT.format(
        address=address,
        bedrooms=bedrooms or "See video",
        bathrooms=bathrooms or "See video",
        square_feet=f"{square_feet:,}" if square_feet else "See video",
        features=", ".join(features[:10]) if features else "See video tour",
        public_remarks=public_remarks or "Not available",
        target_words=target_words,
        duration_seconds=duration_seconds,
        style=style
    )


def format_features_prompt(
    address: str,
    property_type: str = "Single Family",
    bedrooms: Optional[int] = None,
    bathrooms: Optional[float] = None,
    square_feet: Optional[int] = None,
    year_built: Optional[int] = None,
    max_features: int = 30
) -> str:
    """Format the features extraction prompt."""
    return FEATURES_PROMPT.format(
        address=address,
        property_type=property_type,
        bedrooms=bedrooms or "Unknown",
        bathrooms=bathrooms or "Unknown",
        square_feet=f"{square_feet:,}" if square_feet else "Unknown",
        year_built=year_built or "Unknown",
        max_features=max_features
    )


def format_reso_prompt(
    address: str,
    street: str,
    city: str,
    state: str,
    zip_code: str,
    property_type: str = "Residential",
    bedrooms: Optional[int] = None,
    bathrooms: Optional[float] = None,
    square_feet: Optional[int] = None,
    year_built: Optional[int] = None,
    price: Optional[float] = None,
    public_remarks: Optional[str] = None,
    features: Optional[List[str]] = None,
    schema_version: str = "2.0"
) -> str:
    """Format the RESO data generation prompt."""
    return RESO_DATA_PROMPT.format(
        address=address,
        street=street,
        city=city or "Unknown",
        state=state or "Unknown",
        zip_code=zip_code,
        property_type=property_type,
        bedrooms=bedrooms or 0,
        bathrooms=bathrooms or 0,
        square_feet=square_feet or 0,
        year_built=year_built or 0,
        price=price or 0,
        public_remarks=public_remarks or "No description available",
        features="\n".join(f"- {f}" for f in (features or [])),
        schema_version=schema_version
    )


# =============================================================================
# PromptTemplates Class (for convenient access)
# =============================================================================

class PromptTemplates:
    """
    Container class for all prompt templates.

    Provides convenient access to all prompts and formatting functions.
    """

    # System prompts
    SYSTEM_PROMPT_REALTOR = SYSTEM_PROMPT_REALTOR
    SYSTEM_PROMPT_VIDEO_HOST = SYSTEM_PROMPT_VIDEO_HOST
    SYSTEM_PROMPT_DATA_ANALYST = SYSTEM_PROMPT_DATA_ANALYST

    # GPT-4.1 Vision prompts
    PUBLIC_REMARKS_SYSTEM = PUBLIC_REMARKS_SYSTEM
    PUBLIC_REMARKS_PROMPT = PUBLIC_REMARKS_PROMPT
    PHOTO_ANALYSIS_PROMPT = PHOTO_ANALYSIS_PROMPT

    # Claude Sonnet 4.5 prompts
    WALKTHRU_SCRIPT_SYSTEM = WALKTHRU_SCRIPT_SYSTEM
    WALKTHRU_SCRIPT_PROMPT = WALKTHRU_SCRIPT_PROMPT

    # Gemini 3 Pro prompts
    FEATURES_SYSTEM = FEATURES_SYSTEM
    FEATURES_PROMPT = FEATURES_PROMPT
    RESO_DATA_SYSTEM = RESO_DATA_SYSTEM
    RESO_DATA_PROMPT = RESO_DATA_PROMPT

    # Formatting functions as static methods
    format_public_remarks_prompt = staticmethod(format_public_remarks_prompt)
    format_walkthru_prompt = staticmethod(format_walkthru_prompt)
    format_features_prompt = staticmethod(format_features_prompt)
    format_reso_prompt = staticmethod(format_reso_prompt)
