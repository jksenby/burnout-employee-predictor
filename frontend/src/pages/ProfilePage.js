import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const ProfilePage = () => {
  const { t } = useTranslation();
  const { user, token } = useAuth();

  const [formData, setFormData] = useState({
    gender: "",
    phone_number: "",
    age: "",
    profession: "",
    workplace: "",
    work_experience: "",
    education_level: "",
    education_place: "",
    specialty: "",
    city: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (user) {
      setFormData({
        gender: user.gender || "",
        phone_number: user.phone_number || "",
        age: user.age || "",
        profession: user.profession || "",
        workplace: user.workplace || "",
        work_experience: user.work_experience ?? "",
        education_level: user.education_level || "",
        education_place: user.education_place || "",
        specialty: user.specialty || "",
        city: user.city || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const body = {
        gender: formData.gender,
        phone_number: formData.phone_number,
        age: Number(formData.age),
        // Send "" (not null) for text fields so a cleared field is persisted —
        // the backend only writes values that are non-null, so null = "leave
        // unchanged" while "" = "clear it".
        profession: formData.profession,
        workplace: formData.workplace,
        work_experience: formData.work_experience !== "" ? Number(formData.work_experience) : null,
        education_level: formData.education_level,
        education_place: formData.education_place,
        specialty: formData.specialty,
        city: formData.city,
      };

      const res = await fetch("http://localhost:8000/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || t("profile.fail_update"));
      }

      setMessage({ type: "success", text: t("profile.success_update") });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    }
  };

  return (
    <div className="page-wrapper profile-page">
      <div className="page-header">
        <h1>{t("profile.title")}</h1>
        <p className="subtitle">{t("profile.subtitle")}</p>
      </div>

      <div className="profile-card">
        <form onSubmit={handleSubmit} className="profile-form">

          {/* Read-only identity */}
          <div className="form-group row">
            <div className="col">
              <label>{t("profile.username")}</label>
              <input type="text" value={user?.username || ""} disabled className="input-disabled" />
            </div>
            <div className="col">
              <label>{t("profile.email")}</label>
              <input type="email" value={user?.email || ""} disabled className="input-disabled" />
            </div>
          </div>

          {/* Basic info */}
          <div className="profile-section-title">{t("profile.section_basic")}</div>

          <div className="form-group">
            <label htmlFor="gender">{t("profile.gender")}</label>
            <select id="gender" name="gender" value={formData.gender} onChange={handleChange} required className="form-input">
              <option value="" disabled>{t("profile.select_gender")}</option>
              <option value="Male">{t("profile.male")}</option>
              <option value="Female">{t("profile.female")}</option>
              <option value="Other">{t("profile.other")}</option>
            </select>
          </div>

          <div className="form-group row">
            <div className="col">
              <label htmlFor="phone_number">{t("profile.phone")}</label>
              <input
                id="phone_number" name="phone_number" type="tel"
                value={formData.phone_number} onChange={handleChange}
                required className="form-input"
              />
            </div>
            <div className="col">
              <label htmlFor="age">{t("profile.age")}</label>
              <input
                id="age" name="age" type="number" min="1" max="120"
                value={formData.age} onChange={handleChange}
                required className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="city">{t("profile.city")}</label>
            <input
              id="city" name="city" type="text"
              value={formData.city} onChange={handleChange}
              placeholder={t("profile.city_placeholder")}
              className="form-input"
            />
          </div>

          {/* Work info */}
          <div className="profile-section-title">{t("profile.section_work")}</div>

          <div className="form-group row">
            <div className="col">
              <label htmlFor="profession">{t("profile.profession")}</label>
              <input
                id="profession" name="profession" type="text"
                value={formData.profession} onChange={handleChange}
                placeholder={t("profile.profession_placeholder")}
                className="form-input"
              />
            </div>
            <div className="col">
              <label htmlFor="workplace">{t("profile.workplace")}</label>
              <input
                id="workplace" name="workplace" type="text"
                value={formData.workplace} onChange={handleChange}
                placeholder={t("profile.workplace_placeholder")}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="work_experience">{t("profile.work_experience")}</label>
            <input
              id="work_experience" name="work_experience" type="number" min="0" max="60"
              value={formData.work_experience} onChange={handleChange}
              placeholder={t("profile.work_experience_placeholder")}
              className="form-input"
            />
          </div>

          {/* Education info */}
          <div className="profile-section-title">{t("profile.section_education")}</div>

          <div className="form-group">
            <label htmlFor="education_level">{t("profile.education_level")}</label>
            <select id="education_level" name="education_level" value={formData.education_level} onChange={handleChange} className="form-input">
              <option value="">{t("profile.select_education_level")}</option>
              <option value="secondary">{t("profile.edu_secondary")}</option>
              <option value="vocational">{t("profile.edu_vocational")}</option>
              <option value="bachelor">{t("profile.edu_bachelor")}</option>
              <option value="master">{t("profile.edu_master")}</option>
              <option value="phd">{t("profile.edu_phd")}</option>
              <option value="other">{t("profile.edu_other")}</option>
            </select>
          </div>

          <div className="form-group row">
            <div className="col">
              <label htmlFor="education_place">{t("profile.education_place")}</label>
              <input
                id="education_place" name="education_place" type="text"
                value={formData.education_place} onChange={handleChange}
                placeholder={t("profile.education_place_placeholder")}
                className="form-input"
              />
            </div>
            <div className="col">
              <label htmlFor="specialty">{t("profile.specialty")}</label>
              <input
                id="specialty" name="specialty" type="text"
                value={formData.specialty} onChange={handleChange}
                placeholder={t("profile.specialty_placeholder")}
                className="form-input"
              />
            </div>
          </div>

          {message.text && (
            <div className={`form-message ${message.type}`}>{message.text}</div>
          )}

          <button type="submit" disabled={loading} className="button profile-submit">
            {loading ? t("profile.saving") : t("profile.save_btn")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
