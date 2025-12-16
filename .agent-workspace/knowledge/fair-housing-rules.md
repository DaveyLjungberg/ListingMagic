# Fair Housing Rules Reference

> CRITICAL: All AI-generated real estate content MUST follow these rules.
> Violations can result in legal action against real estate agents.

---

## The Law

**Fair Housing Act (1968)** + amendments prohibits discrimination in housing based on:
- Race
- Color
- National Origin
- Religion
- Sex (gender, sexual orientation, gender identity)
- Familial Status (children, pregnancy)
- Disability

---

## Prohibited Language

### ❌ Imperative/Invitational Language
These phrases imply a specific buyer type:
- "Step inside"
- "Welcome to"
- "Come see"
- "Imagine yourself"
- "Picture your family"
- "Make this your home"

### ❌ Second-Person Pronouns
Creates personal connection that could discriminate:
- "you", "your", "you'll"
- "you'll love"
- "your new home"
- "perfect for you"

### ❌ Buyer-Specific Language
Implies who should/shouldn't buy:
- "Perfect for families"
- "Ideal for retirees"
- "Great for young professionals"
- "Empty nesters will love"
- "Bachelor pad"
- "Mother-in-law suite" (use "guest suite" instead)

### ❌ Discriminatory Terms
- "Master bedroom" → use "Primary bedroom"
- "Master bath" → use "Primary bathroom"
- "Walking distance to church" → use "Near places of worship"
- "Family neighborhood" → use "Established neighborhood"

### ❌ Location Descriptions That Imply Demographics
- "Ethnic neighborhood"
- "Diverse area"
- "Safe neighborhood" (implies other areas are unsafe)
- "Good schools" (can imply demographics)

---

## Required Language Patterns

### ✅ Third-Person Only
- "This residence features..."
- "The property includes..."
- "This home offers..."
- "The kitchen showcases..."

### ✅ Factual Descriptions
- "Located near schools" (factual, not "good schools")
- "Close to public transportation"
- "Within walking distance to parks"

### ✅ Objective Statements
- "The primary bedroom measures 15x12"
- "Hardwood floors throughout main level"
- "Updated kitchen with granite countertops"

---

## Examples

### ❌ WRONG
```
Welcome to this stunning family home! You'll love the spacious master 
bedroom and the perfect backyard for kids. This is the ideal property 
for a growing family in a safe, quiet neighborhood.
```

### ✅ CORRECT
```
This spacious residence features a generous primary bedroom and a 
well-maintained backyard. The property is located in an established 
neighborhood with mature landscaping and convenient access to local 
amenities.
```

---

## Implementation in QuickList

### Prompt Level (Prevention)
Every AI prompt includes Fair Housing rules in the system message:
```python
FAIR_HOUSING_SYSTEM_PROMPT = """
CRITICAL: You MUST follow Fair Housing compliance rules:
[rules here]
"""
```

### Post-Generation (Detection)
`python-backend/compliance/fair_housing.py` validates output:
```python
async def validate_fair_housing(text: str) -> List[str]:
    violations = []
    # Check for prohibited patterns
    # Return list of violations
```

### User Warning (Notification)
UI displays warnings if any violations detected:
```jsx
{fairHousingWarnings.length > 0 && (
  <div className="bg-red-50 ...">
    ⚠️ Fair Housing Concerns: {warnings}
  </div>
)}
```

---

## Resources

- **HUD Guidelines**: https://www.hud.gov/program_offices/fair_housing_equal_opp
- **NAR Resources**: https://www.nar.realtor/fair-housing
- **State-specific rules**: Check local real estate commission

---

## When in Doubt

If unsure whether language is compliant:
1. Remove any reference to people/buyers
2. Describe only the physical property
3. Use third-person exclusively
4. Focus on features, not who would like them
