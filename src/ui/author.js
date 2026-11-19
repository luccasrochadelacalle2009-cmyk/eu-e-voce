import { profileName } from "../core/cloud.js";
import { esc } from "../core/utils.js";

/** Rodapé que identifica quem criou e quem editou por último. */
export function authorNote(record) {
  if (!record) return "";
  const created = profileName(record.createdBy);
  const edited = record.updatedBy && record.updatedBy !== record.createdBy
    ? " · editado por " + esc(profileName(record.updatedBy))
    : "";
  return '<small class="author-note">Por ' + esc(created) + edited + "</small>";
}
