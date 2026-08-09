import * as service from './documents.service.js';
import { createUploadUrl, storageStatus } from '../../utils/storage.js';

export async function listDocumentsHandler(req, res) {
  res.json(await service.listDocuments(req.query));
}

export async function facetsHandler(req, res) {
  res.json(await service.listFacets({ category: req.query.category }));
}

export async function countsHandler(req, res) {
  res.json({ counts: await service.countByCategory() });
}

export async function createDocumentHandler(req, res) {
  res.status(201).json(await service.createDocument(req.body));
}

export async function updateDocumentHandler(req, res) {
  res.json(await service.updateDocument(req.params.id, req.body));
}

export async function archiveDocumentHandler(req, res) {
  await service.archiveDocument(req.params.id);
  res.status(204).send();
}

// Two-step upload: the client asks for a signed URL, PUTs the file straight to the
// bucket, then POSTs /api/documents with the returned fileUrl. Keeping the bytes
// out of Express means an upload does not occupy an API worker for its duration.
export async function uploadUrlHandler(req, res) {
  res.json(await createUploadUrl(req.body));
}

// Lets the admin UI show "uploads are not configured" up front instead of only
// discovering it when someone picks a file.
export async function storageStatusHandler(req, res) {
  res.json(storageStatus());
}
