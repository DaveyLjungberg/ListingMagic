"""
Listing Magic - Vision Analyzer

GPT-4.1 specific module for analyzing property photos
and extracting features automatically.
"""

import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

from config import VISION_CONFIG

logger = logging.getLogger(__name__)


@dataclass
class RoomAnalysis:
    """Analysis of a single room from photos."""
    room_type: str
    features: List[str] = field(default_factory=list)
    condition: Optional[str] = None
    confidence: float = 0.0
    photo_indices: List[int] = field(default_factory=list)


@dataclass
class PropertyAnalysis:
    """Complete property analysis from all photos."""
    rooms: List[RoomAnalysis] = field(default_factory=list)
    exterior_features: List[str] = field(default_factory=list)
    overall_style: Optional[str] = None
    overall_condition: Optional[str] = None
    estimated_bedrooms: Optional[int] = None
    estimated_bathrooms: Optional[float] = None
    notable_features: List[str] = field(default_factory=list)
    quality_score: float = 0.0  # 0-10 rating of property quality
    photo_quality: float = 0.0  # 0-10 rating of photo quality
    confidence_scores: Dict[str, float] = field(default_factory=dict)


class VisionAnalyzer:
    """
    Analyzes property photos using GPT-4.1 Vision.

    Capabilities:
    - Room detection and counting
    - Feature extraction per room
    - Overall property assessment
    - Photo quality evaluation
    - Style and condition analysis
    """

    FEATURES_TO_EXTRACT = VISION_CONFIG["gpt41_features_to_extract"]

    # Room type detection keywords
    ROOM_TYPES = {
        "kitchen": ["kitchen", "cooking", "stove", "refrigerator", "sink", "counter"],
        "living_room": ["living room", "sofa", "couch", "fireplace", "tv"],
        "dining_room": ["dining", "table", "chairs", "chandelier"],
        "bedroom": ["bedroom", "bed", "mattress", "nightstand", "closet"],
        "bathroom": ["bathroom", "toilet", "shower", "bathtub", "vanity", "sink"],
        "office": ["office", "desk", "computer", "bookshelf"],
        "garage": ["garage", "car", "storage"],
        "patio": ["patio", "outdoor", "deck", "grill"],
        "backyard": ["backyard", "yard", "garden", "lawn", "pool"],
        "front_yard": ["front yard", "driveway", "entrance", "porch"]
    }

    def __init__(self):
        self.last_analysis: Optional[PropertyAnalysis] = None
        logger.info("Vision Analyzer initialized for GPT-4.1")

    def _detect_room_type(self, features: List[str]) -> str:
        """Detect room type from extracted features."""
        features_text = " ".join(features).lower()

        for room_type, keywords in self.ROOM_TYPES.items():
            if any(keyword in features_text for keyword in keywords):
                return room_type

        return "unknown"

    def _estimate_room_counts(
        self,
        rooms: List[RoomAnalysis]
    ) -> Dict[str, int]:
        """Estimate bedroom and bathroom counts from room analysis."""
        bedrooms = sum(1 for r in rooms if r.room_type == "bedroom")
        bathrooms = sum(1 for r in rooms if r.room_type == "bathroom")

        # Add half bath if small bathroom detected
        # (This would be refined with actual vision analysis)

        return {
            "bedrooms": bedrooms,
            "bathrooms_full": bathrooms,
            "bathrooms_half": 0
        }

    def _assess_condition(
        self,
        features: List[str]
    ) -> str:
        """Assess overall condition from features."""
        positive_keywords = [
            "new", "updated", "renovated", "modern", "pristine",
            "excellent", "well-maintained", "upgraded", "custom"
        ]
        negative_keywords = [
            "dated", "old", "worn", "needs work", "fixer",
            "original", "tired", "damaged"
        ]

        features_text = " ".join(features).lower()

        positive_count = sum(1 for kw in positive_keywords if kw in features_text)
        negative_count = sum(1 for kw in negative_keywords if kw in features_text)

        if positive_count > negative_count + 2:
            return "Excellent"
        elif positive_count > negative_count:
            return "Good"
        elif negative_count > positive_count:
            return "Needs Work"
        else:
            return "Average"

    def _extract_notable_features(
        self,
        rooms: List[RoomAnalysis],
        exterior: List[str]
    ) -> List[str]:
        """Extract the most notable features across the property."""
        notable_keywords = [
            "pool", "spa", "view", "smart", "solar", "wine",
            "theater", "gym", "elevator", "custom", "built-in",
            "marble", "granite", "hardwood", "vaulted", "fireplace",
            "gourmet", "chef", "primary suite", "walk-in"
        ]

        all_features = exterior.copy()
        for room in rooms:
            all_features.extend(room.features)

        notable = []
        features_text = " ".join(all_features).lower()

        for keyword in notable_keywords:
            if keyword in features_text:
                # Find the full feature containing this keyword
                for feature in all_features:
                    if keyword in feature.lower() and feature not in notable:
                        notable.append(feature)
                        break

        return notable[:10]  # Top 10 notable features

    async def analyze_photos(
        self,
        images: List[Dict[str, Any]],
        property_context: Optional[Dict[str, Any]] = None
    ) -> PropertyAnalysis:
        """
        Analyze property photos and extract detailed information.

        Args:
            images: List of image data (base64 or URLs)
            property_context: Optional context (address, known features)

        Returns:
            PropertyAnalysis with extracted information
        """
        logger.info(f"Analyzing {len(images)} property photos with GPT-4.1 Vision")

        # TODO: Implement actual GPT-4.1 Vision API call
        # For now, return mock analysis

        # Mock room analysis
        mock_rooms = [
            RoomAnalysis(
                room_type="kitchen",
                features=[
                    "Granite countertops",
                    "Stainless steel appliances",
                    "Center island with seating",
                    "Custom white cabinetry",
                    "Recessed lighting",
                    "Tile backsplash"
                ],
                condition="Excellent",
                confidence=0.92,
                photo_indices=[0, 1, 2]
            ),
            RoomAnalysis(
                room_type="living_room",
                features=[
                    "Open floor plan",
                    "Hardwood floors",
                    "Fireplace",
                    "Large windows",
                    "Crown molding",
                    "9-foot ceilings"
                ],
                condition="Excellent",
                confidence=0.89,
                photo_indices=[3, 4]
            ),
            RoomAnalysis(
                room_type="bedroom",
                features=[
                    "Walk-in closet",
                    "Carpet flooring",
                    "Ceiling fan",
                    "Large windows"
                ],
                condition="Good",
                confidence=0.85,
                photo_indices=[5]
            ),
            RoomAnalysis(
                room_type="bedroom",
                features=[
                    "Tray ceiling",
                    "Walk-in closet",
                    "Hardwood floors",
                    "Ensuite bathroom access"
                ],
                condition="Excellent",
                confidence=0.88,
                photo_indices=[6, 7]
            ),
            RoomAnalysis(
                room_type="bedroom",
                features=[
                    "Standard closet",
                    "Carpet flooring",
                    "Good natural light"
                ],
                condition="Good",
                confidence=0.82,
                photo_indices=[8]
            ),
            RoomAnalysis(
                room_type="bedroom",
                features=[
                    "Standard closet",
                    "Carpet flooring"
                ],
                condition="Good",
                confidence=0.80,
                photo_indices=[9]
            ),
            RoomAnalysis(
                room_type="bathroom",
                features=[
                    "Dual vanities",
                    "Soaking tub",
                    "Separate shower",
                    "Tile flooring",
                    "Private water closet"
                ],
                condition="Excellent",
                confidence=0.91,
                photo_indices=[10]
            ),
            RoomAnalysis(
                room_type="bathroom",
                features=[
                    "Single vanity",
                    "Shower/tub combo",
                    "Tile flooring"
                ],
                condition="Good",
                confidence=0.85,
                photo_indices=[11]
            ),
            RoomAnalysis(
                room_type="bathroom",
                features=[
                    "Pedestal sink",
                    "Half bath"
                ],
                condition="Good",
                confidence=0.88,
                photo_indices=[12]
            )
        ]

        mock_exterior = [
            "Covered front porch",
            "Two-car attached garage",
            "Professional landscaping",
            "Fenced backyard",
            "Covered patio",
            "Irrigation system"
        ]

        # Calculate room counts
        room_counts = self._estimate_room_counts(mock_rooms)
        bedrooms = room_counts["bedrooms"]
        bathrooms = room_counts["bathrooms_full"] + (room_counts["bathrooms_half"] * 0.5)

        # Extract notable features
        notable = self._extract_notable_features(mock_rooms, mock_exterior)

        analysis = PropertyAnalysis(
            rooms=mock_rooms,
            exterior_features=mock_exterior,
            overall_style="Contemporary Craftsman",
            overall_condition="Excellent - Move-in Ready",
            estimated_bedrooms=bedrooms,
            estimated_bathrooms=bathrooms,
            notable_features=notable,
            quality_score=8.5,
            photo_quality=9.0,
            confidence_scores={
                "room_detection": 0.88,
                "feature_extraction": 0.85,
                "condition_assessment": 0.82,
                "style_detection": 0.78
            }
        )

        self.last_analysis = analysis

        logger.info(
            f"Photo analysis complete. Detected: {bedrooms} bed, "
            f"{bathrooms} bath, {len(mock_rooms)} rooms, "
            f"{len(notable)} notable features"
        )

        return analysis

    def get_features_summary(
        self,
        analysis: Optional[PropertyAnalysis] = None
    ) -> Dict[str, Any]:
        """
        Get a summary of extracted features suitable for prompt injection.

        Returns a dictionary that can be used to enhance AI prompts.
        """
        analysis = analysis or self.last_analysis

        if not analysis:
            return {}

        return {
            "bedrooms": analysis.estimated_bedrooms,
            "bathrooms": analysis.estimated_bathrooms,
            "style": analysis.overall_style,
            "condition": analysis.overall_condition,
            "notable_features": analysis.notable_features,
            "kitchen_features": next(
                (r.features for r in analysis.rooms if r.room_type == "kitchen"),
                []
            ),
            "exterior_features": analysis.exterior_features,
            "quality_score": analysis.quality_score,
            "confidence": analysis.confidence_scores
        }
