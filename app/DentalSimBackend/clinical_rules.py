import random

CLINICAL_DATA = {
    "Pericoronitis": {
        "percussion": "Positive tenderness to percussion (especially vertical tap).",
        "thermal": "Normal response to thermal stimuli."
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
        "percussion": "Positive. Tenderness to percussion, especially on the affected tooth.",
        "thermal": "Normal response to thermal stimuli."
    },
    "Acute Apical Periodontitis": {
        "percussion": "Positive. Severe tenderness to percussion and biting pressure.",
        "thermal": "Negative. No response to cold or heat."
    },
    "Pulp Necrosis": {
        "percussion": "Negative. No tenderness to percussion.",
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
        "percussion": {
            "options": [
                "Negative. No tenderness to percussion.",
                "Slight tenderness to percussion."
            ],
            "weights": [0.6, 0.4]
        },
        "thermal": "Negative. No response to cold or heat."
    },
    "Acute Total Pulpitis": {
        "percussion": "Positive. Tenderness to percussion.",
        "thermal": "Intense, lingering pain that lasts for minutes after stimulus removal."
    },
    "Acute Apical Abscess": {
        "percussion": "Positive. Severe pain on percussion and palpation",
        "thermal": "Negative."
    },
    "Sialolithiasis": {
        "percussion": "Negative. No tenderness to percussion.",
        "thermal": "Normal response to thermal stimuli."
    },
    "Trigeminal Neuralgia": {
        "percussion": "Negative. No tenderness to percussion.",
        "thermal": "Normal response to thermal stimuli."
    },
    "Denture-Related Pain": {
        "percussion": "Negative. No tenderness to percussion.",
        "thermal": "Normal response to thermal stimuli."
    },
    "TMJ Pain": {
        "percussion": "Negative. No tenderness to percussion.",
        "thermal": "Normal response to thermal stimuli."
    },
    "Otitis": {
        "percussion": "Negative. No tenderness to percussion.",
        "thermal": "Normal response to thermal stimuli."
    },
    "Peritonsillar Abscess": {
        "percussion": "Negative. No tenderness to percussion.",
        "thermal": "Normal response to thermal stimuli."
    }
}
def resolve_clinical_test(disease_name, test_type):
    """
    Helper to return a specific string result based on the config.
    """
    disease_data = CLINICAL_DATA.get(disease_name)

    # If disease not in config, or test not applicable
    if not disease_data or test_type not in disease_data:
        return "This test is not applicable for this case."

    test_config = disease_data[test_type]

    # If it's a simple string, return it
    if isinstance(test_config, str):
        return test_config

    # If it's probabilistic dictionary
    if isinstance(test_config, dict) and "options" in test_config:
        # random.choices returns a list, so we take [0]
        return random.choices(test_config["options"], weights=test_config.get("weights"))[0]

    return "Data format error."