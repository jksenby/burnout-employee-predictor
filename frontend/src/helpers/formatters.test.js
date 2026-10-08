import {
  formatFloat,
  formatHz,
  formatPercent,
  formatDeviation,
  formatSentiment,
  normalizeRiskLabel,
  capitalize,
} from "./formatters";

describe("numeric formatters", () => {
  test("render a dash for missing values", () => {
    expect(formatFloat(null)).toBe("—");
    expect(formatHz(undefined)).toBe("—");
    expect(formatPercent(null)).toBe("—");
    expect(formatDeviation(null)).toBe("—");
  });

  test("keep zero as a real value", () => {
    expect(formatFloat(0)).toBe("0.0000");
    expect(formatPercent(0)).toBe("0.0%");
  });

  test("format units", () => {
    expect(formatHz(123.456)).toBe("123.5 Hz");
    expect(formatPercent(0.4567)).toBe("45.7%");
  });
});

describe("formatDeviation", () => {
  test("marks deterioration with an explicit plus", () => {
    expect(formatDeviation(0.25)).toBe("+25");
  });

  test("keeps the minus for improvement", () => {
    expect(formatDeviation(-0.4)).toBe("-40");
  });
});

describe("normalizeRiskLabel", () => {
  test("maps the model label to the UI label", () => {
    expect(normalizeRiskLabel("Medium Risk")).toBe("Moderate Risk");
  });

  test("passes other labels through", () => {
    expect(normalizeRiskLabel("High Risk")).toBe("High Risk");
    expect(normalizeRiskLabel(null)).toBe(null);
  });
});

describe("text formatters", () => {
  test("classifies sentiment around the neutral band", () => {
    expect(formatSentiment(0.3)).toBe("Positive (0.30)");
    expect(formatSentiment(-0.3)).toBe("Negative (-0.30)");
    expect(formatSentiment(0.01)).toBe("Neutral (0.01)");
  });

  test("capitalize", () => {
    expect(capitalize("sad")).toBe("Sad");
    expect(capitalize("")).toBe("—");
  });
});
