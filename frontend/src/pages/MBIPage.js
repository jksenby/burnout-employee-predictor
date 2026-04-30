import React from "react";
import { useTranslation } from "react-i18next";
import MBIQuestionnaire from "../components/MBIQuestionnaire";

const MBIPage = () => {
  const { t } = useTranslation();
  return (
    <>
      <div className="page-header">
        <h1>{t("mbi.title")}</h1>
        <p className="subtitle">
          {t("mbi.subtitle")}
        </p>
      </div>

      <MBIQuestionnaire />
    </>
  );
};

export default MBIPage;
