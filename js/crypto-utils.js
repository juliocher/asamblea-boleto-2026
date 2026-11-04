/**
 * crypto-utils.js - Utilidades criptográficas compartidas con Web Crypto API
 * Compatible con los estándares AES-256-GCM y PBKDF2 generados por build.js
 */

const CryptoUtils = {
  /**
   * Normaliza un nombre: minúsculas, sin tildes/acentos, sin espacios redundantes.
   */
  normalizeName(str) {
    if (!str) return '';
    return str
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ');
  },

  /**
   * Normaliza un teléfono: extrae únicamente los dígitos numéricos.
   */
  normalizePhone(str) {
    if (!str) return '';
    return str.replace(/\D/g, '');
  },

  /**
   * Calcula el hash SHA-256 de una cadena en formato hexadecimal.
   */
  async sha256Hex(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Convierte una cadena Base64 a Uint8Array
   */
  base64ToBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  },

  /**
   * Descifra datos cifrados con AES-256-GCM y clave derivada por PBKDF2
   * @param {string} base64Data Texto cifrado + tag de autenticación (Base64)
   * @param {string} base64Iv Vector de inicialización de 12 bytes (Base64)
   * @param {string} base64Salt Sal de PBKDF2 de 16 bytes (Base64)
   * @param {string} secret Secreto (nombre+teléfono o contraseña de admin)
   * @returns {Promise<any>} Objeto JSON descifrado
   */
  async decryptAesGcm(base64Data, base64Iv, base64Salt, secret) {
    const saltBuffer = this.base64ToBuffer(base64Salt);
    const ivBuffer = this.base64ToBuffer(base64Iv);
    const dataBuffer = this.base64ToBuffer(base64Data);

    const encoder = new TextEncoder();
    const secretBuffer = encoder.encode(secret);

    // 1. Importar la contraseña como clave base de PBKDF2
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      secretBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // 2. Derivar la clave AES-GCM de 256 bits (100,000 iteraciones, SHA-256)
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['decrypt']
    );

    // 3. Descifrar los datos con AES-GCM
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      derivedKey,
      dataBuffer
    );

    // 4. Decodificar a texto y parsear JSON
    const decoder = new TextDecoder('utf-8');
    const jsonStr = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonStr);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CryptoUtils;
}
