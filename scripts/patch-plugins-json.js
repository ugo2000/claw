const fs = require('fs');
const path = require('path');

const PLUGINS_FILE = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'capacitor.plugins.json');

// Read existing plugins
let plugins = [];
if (fs.existsSync(PLUGINS_FILE)) {
  const raw = fs.readFileSync(PLUGINS_FILE, 'utf8');
  try {
    plugins = JSON.parse(raw);
  } catch (e) {
    console.warn('Warning: capacitor.plugins.json is not valid JSON, resetting.');
    plugins = [];
  }
} else {
  const dir = path.dirname(PLUGINS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Check if NativeHttp is already registered
const exists = plugins.some(p => p.pkg === 'NativeHttp');
if (!exists) {
  plugins.push({
    pkg: 'NativeHttp',
    classpath: 'com.ugoclaw.app.plugins.NativeHttp',
  });
  fs.writeFileSync(PLUGINS_FILE, JSON.stringify(plugins, null, 2));
  console.log('✅ Added NativeHttp to capacitor.plugins.json');
} else {
  console.log('ℹ️  NativeHttp already in capacitor.plugins.json, skipping.');
}

// Also ensure NativeHttp.java exists in the correct directory
const pluginSrc = path.join(__dirname, '..', 'NativeHttp.java.template');
const pluginDestDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'ugoclaw', 'app', 'plugins');
const pluginDest = path.join(pluginDestDir, 'NativeHttp.java');

if (fs.existsSync(pluginSrc) && !fs.existsSync(pluginDest)) {
  if (!fs.existsSync(pluginDestDir)) {
    fs.mkdirSync(pluginDestDir, { recursive: true });
  }
  fs.copyFileSync(pluginSrc, pluginDest);
  console.log('✅ Copied NativeHttp.java from template');
} else if (!fs.existsSync(pluginSrc)) {
  console.warn('⚠️  NativeHttp.java.template not found, skipping copy.');
} else {
  console.log('ℹ️  NativeHttp.java already exists, skipping copy.');
}
