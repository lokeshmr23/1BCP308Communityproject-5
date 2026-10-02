import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, FilePlus2, ImagePlus, MapPinned, Navigation, ShieldCheck, X } from 'lucide-react';
import { api } from '../api';
import { displayCategory, displayWard, t } from '../i18n';
import { Button, Field, Modal } from '../components/Shared';

const initial = { title: '', categoryId: '', wardId: '', publicSummary: '', description: '', locationText: '', latitude: '', longitude: '', isPublic: true };

export default function ComplaintFormModal({ open, onClose, language, categories, wards, onCreated, notify, editingComplaint = null }) {
  const [form, setForm] = useState(initial);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);
  const kn = language === 'kn';
  useEffect(() => {
    if (!open) return;
    if (editingComplaint) {
      setForm({ title: editingComplaint.title || '', categoryId: editingComplaint.category_id || '', wardId: editingComplaint.ward_id || '', publicSummary: editingComplaint.public_summary || '', description: editingComplaint.description || '', locationText: editingComplaint.location_text || '', latitude: editingComplaint.latitude || '', longitude: editingComplaint.longitude || '', isPublic: Boolean(editingComplaint.is_public) });
      setPhoto(null); setPhotoPreview(editingComplaint.photo_url || ''); setRemoveExistingPhoto(false);
    } else {
      setForm({ ...initial }); setPhoto(null); setPhotoPreview(''); setRemoveExistingPhoto(false);
    }
    setErrors({});
    if (fileRef.current) fileRef.current.value = '';
  }, [open, editingComplaint?.id]);
  const update = (key, value) => { setForm((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: '' })); };

  const useMyLocation = () => {
    if (!navigator.geolocation) { notify?.(kn ? 'ಈ ಸಾಧನದಲ್ಲಿ ಸ್ಥಳ ಲಭ್ಯವಿಲ್ಲ.' : 'Location is not available on this device.', 'error'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      update('latitude', String(position.coords.latitude.toFixed(6)));
      update('longitude', String(position.coords.longitude.toFixed(6)));
      setLocating(false);
      notify?.(kn ? 'ಸ್ಥಳ ಸೇರಿಸಲಾಗಿದೆ.' : 'Location added.', 'success');
    }, () => { setLocating(false); notify?.(kn ? 'ಸ್ಥಳ ಅನುಮತಿ ಲಭ್ಯವಿಲ್ಲ.' : 'Location permission was not granted.', 'error'); }, { enableHighAccuracy: false, timeout: 10_000 });
  };

  const choosePhoto = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { notify?.(kn ? 'JPG, PNG ಅಥವಾ WebP ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ.' : 'Choose a JPG, PNG or WebP image.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { notify?.(kn ? 'ಫೋಟೋ ಗಾತ್ರ 5 MB ಗಿಂತ ಕಡಿಮೆ ಇರಬೇಕು.' : 'Photo must be 5 MB or smaller.', 'error'); return; }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemoveExistingPhoto(false);
  };

  const validate = () => {
    const next = {};
    if (form.title.trim().length < 5) next.title = kn ? 'ಕನಿಷ್ಠ 5 ಅಕ್ಷರಗಳು.' : 'Use at least 5 characters.';
    if (!form.categoryId) next.categoryId = kn ? 'ವರ್ಗ ಆಯ್ಕೆಮಾಡಿ.' : 'Choose a category.';
    if (!form.wardId) next.wardId = kn ? 'ವಾರ್ಡ್ ಆಯ್ಕೆಮಾಡಿ.' : 'Choose a ward.';
    if (form.description.trim().length < 10) next.description = kn ? 'ವಿವರಣೆಗೆ ಕನಿಷ್ಠ 10 ಅಕ್ಷರಗಳು.' : 'Add at least 10 characters.';
    if (form.publicSummary.trim().length < 3) next.publicSummary = kn ? 'ಕನಿಷ್ಠ 3 ಅಕ್ಷರಗಳ ಸಾರ್ವಜನಿಕ ಸಾರಾಂಶ ನೀಡಿ.' : 'Add a public summary of at least 3 characters.';
    if (form.publicSummary.trim().length > 300) next.publicSummary = kn ? '300 ಅಕ್ಷರಗಳೊಳಗೆ ಇರಲಿ.' : 'Keep this under 300 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, typeof value === 'boolean' ? String(value) : value));
      if (photo) data.append('photo', photo);
      if (editingComplaint) data.append('removePhoto', String(removeExistingPhoto));
      const complaint = await api(editingComplaint ? `/complaints/${editingComplaint.id}` : '/complaints', { method: editingComplaint ? 'PUT' : 'POST', body: data });
      notify?.(editingComplaint ? (kn ? 'ದೂರು ವಿವರಗಳನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ.' : 'Complaint details updated.') : (kn ? 'ದೂರು ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಸಲಾಗಿದೆ.' : 'Complaint submitted successfully.'), 'success');
      setForm({ ...initial }); setPhoto(null); setPhotoPreview(''); setErrors({}); setRemoveExistingPhoto(false);
      onCreated?.(complaint);
    } catch (error) { notify?.(error.message, 'error'); }
    finally { setBusy(false); }
  };

  return <Modal open={open} onClose={onClose} title={editingComplaint ? `${t(language, 'edit')} · ${editingComplaint.reference_id}` : t(language, 'newComplaint')} subtitle={kn ? 'ನಿಮ್ಮ ದೂರು ಸರಿಯಾದ ತಂಡಕ್ಕೆ ತಲುಪುವಂತೆ ವಿವರ ನೀಡಿ.' : 'Share enough detail to help the right Panchayat team respond.'} size="large">
    <form className="complaint-form" onSubmit={submit}>
      <div className="form-privacy-banner"><span><ShieldCheck size={16} /></span><p>{kn ? 'ನಿಮ್ಮ ಹೆಸರು ಮತ್ತು ಸಂಪರ್ಕ ಮಾಹಿತಿ ಪಂಚಾಯತ್ ಸಿಬ್ಬಂದಿಗೆ ಮಾತ್ರ ಕಾಣುತ್ತದೆ.' : 'Your name and contact information are visible only to authorized Panchayat staff.'}<b> {t(language, 'locationPrivacy')}</b></p></div>
      <div className="form-row">
        <Field label={t(language, 'complaintTitle')} required error={errors.title}>
          <input className="form-input" value={form.title} onChange={(event) => update('title', event.target.value)} maxLength={120} placeholder={kn ? 'ಉದಾ: ವಾರ್ಡ್‌ನಲ್ಲಿ ನೀರಿನ ಸೋರಿಕೆ' : 'e.g. Water leak on the main lane'} />
        </Field>
        <Field label={t(language, 'category')} required error={errors.categoryId}>
          <select className="form-input" value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">{t(language, 'selectCategory')}</option>{categories.map((item) => <option key={item.id} value={item.id}>{displayCategory(item, language)}</option>)}</select>
        </Field>
      </div>
      <div className="form-row">
        <Field label={t(language, 'ward')} required error={errors.wardId}>
          <select className="form-input" value={form.wardId} onChange={(event) => update('wardId', event.target.value)}><option value="">{t(language, 'selectWard')}</option>{wards.map((item) => <option key={item.id} value={item.id}>{displayWard(item, language)}</option>)}</select>
        </Field>
        <Field label={t(language, 'location')} hint={kn ? 'ಹತ್ತಿರದ ಗುರುತು; ಮನೆ ಸಂಖ್ಯೆ ಅಗತ್ಯವಿಲ್ಲ.' : 'A nearby landmark is enough; avoid sharing a house number.'}>
          <div className="input-action-wrap"><MapPinned size={16} /><input className="plain-input" value={form.locationText} onChange={(event) => update('locationText', event.target.value)} maxLength={240} placeholder={kn ? 'ಉದಾ: ಸರ್ಕಾರಿ ಶಾಲೆಯ ಹತ್ತಿರ' : 'e.g. Near the government school'} /></div>
        </Field>
      </div>
      <Field label={t(language, 'publicSummary')} required hint={t(language, 'publicRequired')} error={errors.publicSummary}>
        <input className="form-input" value={form.publicSummary} onChange={(event) => update('publicSummary', event.target.value)} maxLength={300} required minLength={3} placeholder={kn ? 'ವೈಯಕ್ತಿಕ ವಿವರಗಳಿಲ್ಲದ ಚಿಕ್ಕ ಸಾರಾಂಶ' : 'A short, non-personal summary for the public board'} />
      </Field>
      <Field label={t(language, 'description')} required error={errors.description}>
        <textarea className="form-input form-textarea" value={form.description} onChange={(event) => update('description', event.target.value)} maxLength={3000} rows={4} placeholder={kn ? 'ಸಮಸ್ಯೆ ಎಲ್ಲಿ ಮತ್ತು ಯಾವಾಗ ಸಂಭವಿಸುತ್ತದೆ? ಅಗತ್ಯವಿರುವ ಕ್ರಮವೇನು?' : 'Where and when does this happen? What action would help?'} />
        <span className="char-counter">{form.description.length} / 3000</span>
      </Field>
      <div className="form-row location-row">
        <Field label={kn ? 'ಅಕ್ಷಾಂಶ (ಐಚ್ಛಿಕ)' : 'Latitude (optional)'}><input className="form-input" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} placeholder="12.764" /></Field>
        <Field label={kn ? 'ರೇಖಾಂಶ (ಐಚ್ಛಿಕ)' : 'Longitude (optional)'}><input className="form-input" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} placeholder="75.197" /></Field>
        <Button variant="soft" icon={Navigation} onClick={useMyLocation} disabled={locating}>{locating ? t(language, 'loadingMore') : t(language, 'useLocation')}</Button>
      </div>
      <div className="form-row attachment-row">
        <div className="photo-field-wrap">
          <span className="field-label">{t(language, 'photo')}</span>
          {photoPreview && !removeExistingPhoto ? <div className="photo-preview"><img src={photoPreview} alt="Complaint attachment preview" /><span><b>{photo?.name || (kn ? 'ಪ್ರಸ್ತುತ ಫೋಟೋ' : 'Current photo')}</b><small>{photo ? `${(photo.size / 1024 / 1024).toFixed(1)} MB` : (kn ? 'ಉಳಿಸಲು ಹೊಸ ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ' : 'Choose a new photo to replace')}</small></span><button type="button" onClick={() => { if (photo && editingComplaint?.photo_url) { setPhoto(null); setPhotoPreview(editingComplaint.photo_url); setRemoveExistingPhoto(false); } else { setPhoto(null); setPhotoPreview(''); setRemoveExistingPhoto(Boolean(editingComplaint?.photo_url)); } if (fileRef.current) fileRef.current.value = ''; }} aria-label="Remove photo"><X size={15} /></button></div> : <button type="button" className="photo-picker" onClick={() => { setRemoveExistingPhoto(false); fileRef.current?.click(); }}><span className="photo-picker-icon"><ImagePlus size={18} /></span><span><b>{kn ? 'ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ' : 'Choose a photo'}</b><small>{t(language, 'photoLimit')}</small></span><Camera size={16} className="photo-picker-end" /></button>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={(event) => choosePhoto(event.target.files?.[0])} />
        </div>
        <label className="public-check"><input type="checkbox" checked={form.isPublic} onChange={(event) => update('isPublic', event.target.checked)} /><span className="custom-check"><CheckCircle2 size={13} /></span><span><b>{t(language, 'visiblePublicly')}</b><small>{t(language, 'publicNote')}</small></span></label>
      </div>
      <div className="modal-actions complaint-submit-row"><Button variant="ghost" onClick={onClose}>{t(language, 'cancel')}</Button><Button type="submit" icon={FilePlus2} disabled={busy}>{busy ? <><span className="button-spinner" />{kn ? 'ಉಳಿಸಲಾಗುತ್ತಿದೆ…' : 'Saving…'}</> : editingComplaint ? t(language, 'save') : t(language, 'submitComplaint')}</Button></div>
    </form>
  </Modal>;
}
