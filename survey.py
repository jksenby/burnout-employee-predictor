class MBIProcessor:
    """Обработка результатов MBI-HSS для калибровки модели"""
    def __init__(self):
        # Субшкалы согласно классической методике
        self.indices = {
            "EE": [1, 2, 3, 6, 8, 13, 14, 16, 20], # Эмоциональное истощение
            "DP": [5, 10, 11, 15, 22],             # Деперсонализация (Цинизм)
            "PA": [4, 7, 9, 12, 17, 18, 19, 21]    # Редукция достижений
        }

    def get_burnout_status(self, answers):
        # Расчет баллов (ответы от 0 до 6)
        scores = {k: sum(answers[i] for i in v) for k, v in self.indices.items()}
        # Высокое выгорание: EE >= 27 ИЛИ DP >= 10
        is_high_risk = scores["EE"] >= 27 or scores["DP"] >= 10
        return {"risk": "HIGH" if is_high_risk else "NORMAL", "details": scores}