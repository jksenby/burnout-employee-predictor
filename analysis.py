import numpy as np

def calculate_burnout_deltas(baseline_medians, current_features):
    """
    Сравнивает текущие признаки с медианой за месяц.
    f0_std: падение вариативности = монотонность
    jitter/shimmer: рост = физическая усталость
    """
    deltas = {
        "f0_change": (current_features['f0_std'] / baseline_medians['f0_std']) - 1,
        "jitter_change": (current_features['jitter'] / baseline_medians['jitter']) - 1
    }
    
    # Тревожный маркер: голос стал на 20% монотоннее
    is_warning = deltas["f0_change"] < -0.20 and deltas["jitter_change"] > 0.15
    return is_warning, deltas