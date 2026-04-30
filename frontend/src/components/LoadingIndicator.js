import React from 'react';
import { useTranslation } from 'react-i18next';

const LoadingIndicator = () => {
  const { t } = useTranslation();
  return (
    <div className="loading show">
      <div className="spinner"></div>
      <p>{t("common.loading")}</p>
      <div className="step-indicator">
        {t("common.pipeline")}
      </div>
    </div>
  );
};

export default LoadingIndicator;
