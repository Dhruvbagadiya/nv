import * as service from './documents.service.js';

export async function listDocumentsHandler(req, res) {
  res.json(await service.listDocuments(req.query));
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
