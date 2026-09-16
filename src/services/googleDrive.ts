import { auth } from '../firebaseConfig';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';

export function getDriveToken(): string | null {
  return sessionStorage.getItem('drive_access_token');
}

export function setDriveToken(token: string | null) {
  if (token) {
    sessionStorage.setItem('drive_access_token', token);
  } else {
    sessionStorage.removeItem('drive_access_token');
  }
}

export async function checkDriveRedirectResult(): Promise<void> {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveToken(credential.accessToken);
      }
    }
  } catch (error) {
    console.error('Drive Redirect Error:', error);
  }
}

export async function requestDriveToken(): Promise<string> {
  const cached = getDriveToken();
  if (cached) return cached;
  
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (credential?.accessToken) {
      setDriveToken(credential.accessToken);
      return credential.accessToken;
    }
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/web-storage-unsupported' || error.message?.includes('popup')) {
      await signInWithRedirect(auth, provider);
      return new Promise(() => {}); // Wait forever while redirecting
    }
    throw error;
  }
  throw new Error('Failed to obtain Google Drive access token.');
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

async function request(url: string, options: RequestInit, token: string) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      setDriveToken(null);
      throw new Error('UNAUTHORIZED');
    }
    const errText = await res.text();
    if (res.status === 403 && errText.includes('has not been used in project')) {
      throw new Error('API_DISABLED');
    }
    throw new Error(`Drive API Error: ${res.status} ${errText}`);
  }
  return res.json();
}

export function formatMonthFolder(monthNum: number): string {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const safeMonth = Math.min(12, Math.max(1, monthNum));
  const monthPadded = String(safeMonth).padStart(2, '0');
  const monthName = monthNames[safeMonth - 1] || 'Janeiro';
  return `${monthPadded} - ${monthName}`;
}

export function parseYearAndMonth(dateString?: string): { year: string; monthNumber: number; monthFolder: string } {
  let date: Date;
  if (!dateString) {
    date = new Date();
  } else if (dateString.includes('T')) {
    date = new Date(dateString);
  } else if (dateString.includes('-')) {
    const parts = dateString.split('-');
    const y = parseInt(parts[0], 10) || new Date().getFullYear();
    const m = (parseInt(parts[1], 10) || (new Date().getMonth() + 1)) - 1;
    const d = parseInt(parts[2], 10) || 1;
    date = new Date(y, m, d);
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) {
    date = new Date();
  }

  const year = String(date.getFullYear());
  const monthNumber = date.getMonth() + 1;
  const monthFolder = formatMonthFolder(monthNumber);

  return { year, monthNumber, monthFolder };
}

export async function getOrCreateFolder(token: string, folderName: string, parentId?: string): Promise<string> {
  const safeName = folderName.trim() || 'Geral';
  const escapedName = safeName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  
  const query = parentId 
    ? `name = '${escapedName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `name = '${escapedName}' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
  const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  const searchResult = await request(searchUrl, { method: 'GET' }, token);
  
  if (searchResult.files && searchResult.files.length > 0) {
    return searchResult.files[0].id;
  }
  
  const metadata = {
    name: safeName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : []
  };
  
  const createUrl = `${DRIVE_API}/files`;
  const createResult = await request(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  }, token);
  
  return createResult.id;
}

export async function uploadFileToDrive(token: string, file: File, folderId: string): Promise<string> {
  const metadata = {
    name: file.name,
    parents: [folderId]
  };
  
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  
  const url = `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink`;
  
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: form
  });
  
  if (!res.ok) {
    if (res.status === 401) {
      setDriveToken(null);
      throw new Error('UNAUTHORIZED');
    }
    const errText = await res.text();
    if (res.status === 403 && errText.includes('has not been used in project')) {
      throw new Error('API_DISABLED');
    }
    throw new Error(`Drive Upload Error: ${res.status} ${errText}`);
  }
  
  const result = await res.json();
  return result.webViewLink;
}

/**
 * Cria preventivamente a pasta da categoria no Google Drive dentro do Ano
 */
export async function createCategoryFolderInDrive(categoryName: string, targetYear?: number): Promise<string | null> {
  const token = getDriveToken();
  if (!token || !categoryName || !categoryName.trim()) return null;
  try {
    const year = String(targetYear || new Date().getFullYear());
    const mainFolderId = await getOrCreateFolder(token, 'comprovantes OrganizaIA');
    const yearFolderId = await getOrCreateFolder(token, year, mainFolderId);
    return await getOrCreateFolder(token, categoryName.trim(), yearFolderId);
  } catch (err) {
    console.warn('Não foi possível pré-criar a pasta da categoria no Google Drive:', err);
    return null;
  }
}

/**
 * Salva o comprovante no Google Drive na estrutura:
 * comprovantes OrganizaIA / [ANO] / [CATEGORIA] / [MÊS] / [ARQUIVO]
 */
export async function uploadReceiptToGoogleDrive(
  file: File, 
  dateString?: string, 
  categoryName?: string
): Promise<string> {
  const token = await requestDriveToken();
  
  // 1. Pasta Principal (Raiz)
  const mainFolderId = await getOrCreateFolder(token, 'comprovantes OrganizaIA');
  
  // 2. Subpasta do Ano (Ex: 2026)
  const { year, monthFolder } = parseYearAndMonth(dateString);
  const yearFolderId = await getOrCreateFolder(token, year, mainFolderId);
  
  // 3. Subpasta da Categoria (Ex: Casa, Cartão, Alimentação, etc.)
  const cleanCategoryName = (categoryName && categoryName.trim()) ? categoryName.trim() : 'Geral';
  const categoryFolderId = await getOrCreateFolder(token, cleanCategoryName, yearFolderId);
  
  // 4. Subpasta do Mês dentro da Categoria (Ex: 08 - Agosto)
  const monthFolderId = await getOrCreateFolder(token, monthFolder, categoryFolderId);
  
  // 5. Upload do Comprovante na pasta do Mês
  return await uploadFileToDrive(token, file, monthFolderId);
}

