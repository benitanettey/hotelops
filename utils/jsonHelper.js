const fs = require('fs').promises;
const path = require('path');

/**
 * Read and parse JSON file
 * @param {string} filePath - Path to JSON file (relative to project root or absolute)
 * @returns {Promise<any>} - Parsed JSON data
 */
async function readJSON(filePath) {
  try {
    // If path is relative, resolve from project root
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(__dirname, '..', filePath);
    
    const data = await fs.readFile(absolutePath, 'utf8');
    
    // Handle empty files - return empty array
    if (!data || data.trim() === '') {
      return [];
    }
    
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is empty, return empty array
    if (error.code === 'ENOENT') {
      console.log(`File not found: ${filePath}, returning empty array`);
      return [];
    }
    
    // If JSON parse error, return empty array
    if (error instanceof SyntaxError) {
      console.log(`Invalid JSON in ${filePath}, returning empty array`);
      return [];
    }
    
    throw error;
  }
}

/**
 * Write data to JSON file
 * @param {string} filePath - Path to JSON file (relative to project root or absolute)
 * @param {any} data - Data to write (will be stringified)
 * @returns {Promise<void>}
 */
async function writeJSON(filePath, data) {
  try {
    // If path is relative, resolve from project root
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(__dirname, '..', filePath);
    
    // Ensure directory exists
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Write with pretty formatting (2 spaces indentation)
    await fs.writeFile(absolutePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    throw error;
  }
}

module.exports = {
  readJSON,
  writeJSON
};
