import numpy as np

class BurnoutClassifier:

    def __init__(self):
        self.labels = ["Low Risk", "Medium Risk", "High Risk"]
        self.embedding_dim = 768

    def predict(self, embedding: list) -> dict:

        try:
            emb = np.array(embedding)

            norm = np.linalg.norm(emb)
            mean_abs = np.mean(np.abs(emb))
            std = np.std(emb)
            pos_ratio = np.sum(emb > 0) / len(emb)
            max_abs = np.max(np.abs(emb))


            skew_approx = np.mean(emb) / (std + 1e-10)

            norm_normalized = np.clip(norm / 10.0, 0, 1)
            std_normalized = np.clip(std / 2.0, 0, 1)
            mean_abs_normalized = np.clip(mean_abs * 10, 0, 1)

            low_variability_risk = 1.0 - std_normalized
            low_energy_risk = 1.0 - norm_normalized
            skew_risk = np.clip(np.abs(skew_approx) / 2.0, 0, 1)

            score = (
                0.50 * low_variability_risk +
                0.30 * low_energy_risk +
                0.20 * skew_risk
            )
            score = np.clip(score, 0.0, 1.0)

            if score < 0.35:
                label = self.labels[0]
                probs = [0.7, 0.25, 0.05]
            elif score < 0.65:
                label = self.labels[1]
                probs = [0.2, 0.6, 0.2]
            else:
                label = self.labels[2]
                probs = [0.05, 0.25, 0.7]

            if label == self.labels[1]:
                mid_score = (score - 0.35) / 0.30
                probs = [
                    0.20 - mid_score * 0.15,
                    0.60,
                    0.20 + mid_score * 0.15
                ]
            
            result = {
                "label": label,
                "score": float(score),
                "confidence": float(max(probs)),
                "probabilities": {
                    self.labels[0]: float(probs[0]),
                    self.labels[1]: float(probs[1]),
                    self.labels[2]: float(probs[2])
                },
                "features": {
                    "embedding_norm": float(norm),
                    "embedding_mean_abs": float(mean_abs),
                    "embedding_std": float(std),
                    "positive_ratio": float(pos_ratio),
                    "max_abs": float(max_abs),
                    "skewness_approx": float(skew_approx),
                    "low_variability_risk": float(low_variability_risk),
                    "low_energy_risk": float(low_energy_risk),
                    "skew_risk": float(skew_risk)
                }
            }

            print(f"Prediction: {label} (score={score:.3f}, norm={norm:.2f}, std={std:.3f})")
            return result

        except Exception as e:
            print(f"Error processing embedding: {e}")
            raise

_classifier = None

def getClassifier():
    global _classifier
    if _classifier is None:
        _classifier = BurnoutClassifier()
    return _classifier

def predict(embedding: list) -> dict:
    classfier = getClassifier()
    return classfier.predict(embedding)