export async function uploadAttachmentsAndSend({ files, workspaceId, projectId, text, uploadFiles, addMessage, onProgress }) {
  let attachments = [];
  if (files.length) {
    const response = await uploadFiles(files, workspaceId, projectId, onProgress);
    if (response?.success !== true || !Array.isArray(response.data) || response.data.length !== files.length || response.data.some((item) => typeof item?.uploadId !== "string" || !item.uploadId)) {
      throw new Error("DevSync could not confirm that every attachment was uploaded. Please retry.");
    }
    attachments = response.data.map(({ uploadId }) => ({ uploadId }));
  }
  return addMessage({ text, attachments });
}
