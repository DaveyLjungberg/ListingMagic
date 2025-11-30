"""
Content Refinement Endpoint for Listing Magic

Allows real-time AI editing of generated content without full regeneration.
Includes Fair Housing compliance validation on all refinements.
"""

import logging
import os
import time
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import anthropic

from compliance import check_fair_housing_compliance, get_compliance_system_prompt

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Content Refinement"])


# =============================================================================
# Request/Response Models
# =============================================================================

class ConversationMessage(BaseModel):
    """A single message in the conversation history."""
    role: str = Field(..., description="Either 'user' or 'assistant'")
    content: str = Field(..., description="The message content")


class RefineContentRequest(BaseModel):
    """Request model for content refinement."""
    content_type: str = Field(
        ...,
        description="Type of content: 'remarks', 'features', or 'script'"
    )
    current_content: str = Field(
        ...,
        min_length=10,
        description="The current content to refine"
    )
    user_instruction: str = Field(
        ...,
        min_length=3,
        description="What the user wants to change"
    )
    conversation_history: List[ConversationMessage] = Field(
        default=[],
        description="Previous refinement conversation"
    )
    property_data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Property context for reference"
    )


class ComplianceViolationResponse(BaseModel):
    """Details of a compliance violation."""
    category: str
    matches: List[str]
    severity: str
    suggestion: str


class RefineContentResponse(BaseModel):
    """Response model for content refinement."""
    success: bool
    refined_content: Optional[str] = None
    error: Optional[str] = None
    error_type: Optional[str] = None
    violations: Optional[List[ComplianceViolationResponse]] = None
    message: Optional[str] = None
    processing_time_ms: float = 0


# =============================================================================
# Helper Functions
# =============================================================================

def build_refinement_prompt(
    content_type: str,
    current_content: str,
    user_instruction: str,
    property_data: Optional[Dict[str, Any]] = None
) -> str:
    """Build the user prompt for content refinement."""
    property_context = ""
    if property_data:
        property_context = f"""
Property context for reference:
- Address: {property_data.get('address', {}).get('full_address', 'N/A')}
- Bedrooms: {property_data.get('bedrooms', 'N/A')}
- Bathrooms: {property_data.get('bathrooms', 'N/A')}
- Square Feet: {property_data.get('sqft', 'N/A')}
- Price: {property_data.get('price', 'N/A')}
"""

    return f"""Current content:
---
{current_content}
---

User's refinement request: {user_instruction}

CRITICAL INSTRUCTIONS:
1. Make ONLY the changes requested by the user
2. Keep all other content exactly the same
3. Maintain the overall structure, tone, and flow
4. Ensure STRICT Fair Housing compliance - NO discriminatory language
5. Return ONLY the updated content - no explanations, no preamble, no "Here's the revised..."
6. If the user's request would violate Fair Housing rules, refuse politely and explain why
{property_context}

Provide the refined content now:"""


# =============================================================================
# Main Endpoint
# =============================================================================

@router.post("/api/refine-content", response_model=RefineContentResponse)
async def refine_content(request: RefineContentRequest) -> RefineContentResponse:
    """
    Refine existing content with targeted AI edits.

    Uses Claude to make specific changes while preserving the rest of the content.
    All refinements are validated for Fair Housing compliance.
    """
    start_time = time.time()

    # Validate content type
    valid_types = ["remarks", "features", "script"]
    if request.content_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid content_type. Must be one of: {valid_types}"
        )

    # Check if user instruction itself contains violations
    instruction_check = check_fair_housing_compliance(request.user_instruction)
    if not instruction_check.is_compliant:
        return RefineContentResponse(
            success=False,
            error="compliance_violation",
            error_type="instruction_violation",
            violations=[
                ComplianceViolationResponse(
                    category=v.category,
                    matches=v.matches,
                    severity=v.severity,
                    suggestion=v.suggestion
                )
                for v in instruction_check.violations
            ],
            message="Your refinement request contains language that may violate Fair Housing laws. Please rephrase without references to protected classes.",
            processing_time_ms=(time.time() - start_time) * 1000
        )

    # Get API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Anthropic API key not configured"
        )

    try:
        client = anthropic.Anthropic(api_key=api_key)

        # Build messages
        messages = []

        # Add conversation history
        for msg in request.conversation_history:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })

        # Add current refinement request
        messages.append({
            "role": "user",
            "content": build_refinement_prompt(
                request.content_type,
                request.current_content,
                request.user_instruction,
                request.property_data
            )
        })

        # Call Claude API
        logger.info(f"Refining {request.content_type} content...")

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=get_compliance_system_prompt(request.content_type),
            messages=messages
        )

        refined_content = response.content[0].text.strip()

        # Check if Claude refused due to compliance
        refusal_phrases = [
            "i can't",
            "i cannot",
            "i'm not able to",
            "i am not able to",
            "violates fair housing",
            "fair housing violation",
            "discriminatory",
            "protected class"
        ]

        if any(phrase in refined_content.lower() for phrase in refusal_phrases):
            return RefineContentResponse(
                success=False,
                error="compliance_violation",
                error_type="ai_refusal",
                message=refined_content,
                processing_time_ms=(time.time() - start_time) * 1000
            )

        # Validate refined content for compliance
        compliance_check = check_fair_housing_compliance(refined_content)

        if not compliance_check.is_compliant:
            logger.warning(f"Refined content failed compliance: {compliance_check.violations}")

            return RefineContentResponse(
                success=False,
                error="compliance_violation",
                error_type="output_violation",
                violations=[
                    ComplianceViolationResponse(
                        category=v.category,
                        matches=v.matches,
                        severity=v.severity,
                        suggestion=v.suggestion
                    )
                    for v in compliance_check.violations
                ],
                message="The refined content contains Fair Housing violations. Please try a different refinement approach.",
                processing_time_ms=(time.time() - start_time) * 1000
            )

        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Content refined successfully in {processing_time:.0f}ms")

        return RefineContentResponse(
            success=True,
            refined_content=refined_content,
            message="Content refined successfully",
            processing_time_ms=processing_time
        )

    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Refinement failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Content refinement failed: {str(e)}"
        )


# =============================================================================
# Compliance Check Endpoint
# =============================================================================

class ComplianceCheckRequest(BaseModel):
    """Request model for compliance checking."""
    text: str = Field(..., min_length=1, description="Text to check for compliance")


class ComplianceCheckResponse(BaseModel):
    """Response model for compliance checking."""
    is_compliant: bool
    violations: List[ComplianceViolationResponse]
    message: str


@router.post("/api/check-compliance", response_model=ComplianceCheckResponse)
async def check_compliance(request: ComplianceCheckRequest) -> ComplianceCheckResponse:
    """
    Check text for Fair Housing compliance without refinement.

    Useful for validating user input before generation.
    """
    result = check_fair_housing_compliance(request.text)

    return ComplianceCheckResponse(
        is_compliant=result.is_compliant,
        violations=[
            ComplianceViolationResponse(
                category=v.category,
                matches=v.matches,
                severity=v.severity,
                suggestion=v.suggestion
            )
            for v in result.violations
        ],
        message=result.message
    )
