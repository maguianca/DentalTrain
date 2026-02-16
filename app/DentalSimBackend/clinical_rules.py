import random

CLINICAL_DATA = {
    "Pericoronitis": {
        "percussion": "Positive tenderness to percussion (especially vertical tap).",
        "thermal": "not available"
    },
    "Reversible Pulpitis": {
        "percussion": "Negative. No tenderness to percussion.",
        "thermal": {
            "options": [
                "Sharp pain to cold, subsides immediately upon removal.",
                "Mild sensitivity to cold."
            ],
            "weights": [0.7, 0.3]
        }
    },
    "Periodontal Abscess": {
        "percussion": "Positive.",
        "thermal": "not available"
    },
    "Acute Apical Periodontitis": {
        "percussion": "Positive. Severe tenderness to percussion and biting pressure.",
        "thermal": "not available"
    },
    "Pulp Necrosis": {
        "percussion": "Negative.",
        "thermal": "Negative. No response to cold or heat."
    },
    "Simple Caries": {
        "percussion": "Negative. No tenderness.",
        "thermal": {
            "options": [
                "Mild sensitivity to cold or sweet, subsides quickly.",
                "No thermal response if very shallow."
            ],
            "weights": [0.6, 0.4]
        }
    },
    "Chronic Apical Periodontitis": {
        "percussion": "Negative.",
        "thermal": "not available"
    },
    "Acute Total Pulpitis": {
        "percussion": {
            "options": [
                "Positive. Slight tenderness.",
                "Negative. No tenderness."
            ],
            "weights": [0.5, 0.5]
        },
        "thermal": {
            "options": [
                "Lingering pain to cold stimuli (more than 10 seconds).",
                "Sharp pain to cold, subsides quickly."
            ],
            "weights": [0.8, 0.2]
        }
    },
    "Acute Apical Abscess": {
        "percussion": "Positive. Severe pain on percussion and palpation",
        "thermal": "Negative."
    },
    "Sialolithiasis": {
        "percussion": "not available",
        "thermal": "not available"
    },
    "Trigeminal Neuralgia": {
        "percussion": "not available",
        "thermal": "not available"
    },
    "Denture-Related Pain": {
        "percussion": "not available",
        "thermal": "not available"
    },
    "TMJ Pain": {
        "percussion": "not available",
        "thermal": "not available"
    },
    "Otitis": {
        "percussion": "not available.",
        "thermal": "not available"
    },
    "Peritonsillar Abscess": {
        "percussion": "not available",
        "thermal": "not available"
    }
}
def resolve_clinical_test(disease_name, test_type):
    """
    Helper to return a specific string result based on the config.
    """
    disease_data = CLINICAL_DATA.get(disease_name)

    # If disease not in config, or test not applicable
    if not disease_data or test_type not in disease_data:
        return "Test Inconclusive or Not Applicable for this case."

    test_config = disease_data[test_type]

    # If it's a simple string, return it
    if isinstance(test_config, str):
        return test_config

    # If it's probabilistic dictionary
    if isinstance(test_config, dict) and "options" in test_config:
        # random.choices returns a list, so we take [0]
        return random.choices(test_config["options"], weights=test_config.get("weights"))[0]

    return "Data format error."