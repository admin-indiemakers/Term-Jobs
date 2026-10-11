import { useEffect } from 'react';

const FIELD_SELECTOR = 'input, textarea, select';
const NON_TEXT_INPUTS = new Set(['hidden', 'button', 'submit', 'reset', 'checkbox', 'radio', 'color', 'range', 'image', 'search']);

function isRelevantField(field) {
  if (field.disabled || field.readOnly || field.getAttribute('aria-hidden') === 'true') return false;
  return field.tagName !== 'INPUT' || !NON_TEXT_INPUTS.has(field.type);
}

function findLabel(field) {
  if (field.labels?.length) return field.labels[0];

  // Older forms often place the label and control in the same wrapper without
  // htmlFor/id. Only associate them when the wrapper has one of each.
  let wrapper = field.parentElement;
  for (let depth = 0; wrapper && depth < 4; depth += 1, wrapper = wrapper.parentElement) {
    const fields = Array.from(wrapper.querySelectorAll(FIELD_SELECTOR)).filter(isRelevantField);
    const labels = wrapper.querySelectorAll('label');
    if (fields.length === 1 && labels.length === 1) return labels[0];
  }
  return null;
}

function updateIndicators() {
  document.querySelectorAll(FIELD_SELECTOR).forEach((field) => {
    if (field.closest('[data-no-field-requirements]')) {
      const label = field.labels?.[0] || field.closest('label');
      if (label) {
        delete label.dataset.fieldRequirement;
        delete label.dataset.fieldRequirementPlacement;
      }
      return;
    }
    if (!isRelevantField(field)) return;
    const label = findLabel(field);
    if (!label || !label.textContent?.trim()) return;

    // Respect labels that already explain their own requirement state.
    if (/\*|\b(required|optional)\b/i.test(label.textContent)) {
      delete label.dataset.fieldRequirement;
      delete label.dataset.fieldRequirementPlacement;
      return;
    }
    label.dataset.fieldRequirement = field.required || field.getAttribute('aria-required') === 'true'
      ? 'required'
      : 'optional';
    label.dataset.fieldRequirementPlacement = label.contains(field) ? 'before' : 'after';
  });
}

export default function FieldRequirementIndicators() {
  useEffect(() => {
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateIndicators();
      });
    };

    scheduleUpdate();
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.getElementById('root'), {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['required', 'aria-required', 'disabled', 'readonly', 'type'],
    });

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
