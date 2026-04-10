const fs = require('fs');
const path = require('path');

const globalCssPath = path.join(__dirname, 'src', 'styles', 'global.css');
if (!fs.existsSync(globalCssPath)) {
    console.error('global.css not found at', globalCssPath);
    process.exit(1);
}

let globalCss = fs.readFileSync(globalCssPath, 'utf8');
const sourceFiles = getFiles(path.join(__dirname, 'src'), ['.jsx', '.tsx']);

// Basic regex to match normal CSS blocks (assumes no complex nested structures for simplicity)
const cssRegex = /([^{}]+)\{([^{}]+)\}/g;
let match;
const rules = [];

while ((match = cssRegex.exec(globalCss)) !== null) {
    rules.push({
        fullText: match[0],
        selector: match[1].trim(),
        content: match[2],
        startIndex: match.index,
        endIndex: cssRegex.lastIndex
    });
}

const componentCssMap = {}; // mapping file path -> rules array
const unmappedRules = [];

rules.forEach(rule => {
    // Extract main class name from selector if possible
    const classMatch = rule.selector.match(/\.([a-zA-Z0-9_-]+)/);
    if (!classMatch || rule.selector.includes('@media') || rule.selector.includes('@keyframes')) {
        unmappedRules.push(rule);
        return;
    }
    
    const className = classMatch[1];
    
    // Find files that use this class name
    const users = [];
    sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        // Simple usage check (includes className)
        if (content.includes(className)) {
            users.push(file);
        }
    });

    // If used in EXACTLY one file, map it
    if (users.length === 1) {
        const file = users[0];
        if (!componentCssMap[file]) componentCssMap[file] = [];
        componentCssMap[file].push(rule);
    } else {
        unmappedRules.push(rule);
    }
});

let extractedCount = 0;

for (const [file, fileRules] of Object.entries(componentCssMap)) {
    const componentName = path.basename(file, path.extname(file));
    const cssFileName = `${componentName}.css`;
    const cssFilePath = path.join(path.dirname(file), cssFileName);
    
    let cssContent = fileRules.map(r => r.fullText).join('\n\n') + '\n';
    
    if (fs.existsSync(cssFilePath)) {
        // Append to existing if it exists
        cssContent = fs.readFileSync(cssFilePath, 'utf8') + '\n\n' + cssContent;
    }
    fs.writeFileSync(cssFilePath, cssContent);
    console.log(`Extracted ${fileRules.length} rules to ${cssFilePath}`);
    extractedCount += fileRules.length;

    // Inject import into the React component
    let compContent = fs.readFileSync(file, 'utf8');
    const importStmt = `import './${cssFileName}';`;
    if (!compContent.includes(importStmt)) {
        fs.writeFileSync(file, `${importStmt}\n${compContent}`);
        console.log(`Injected import into ${file}`);
    }
}

// Rewrite global.css with leftover unmapped rules
const survivingRules = unmappedRules.map(r => r.fullText).join('\n\n') + '\n';
fs.writeFileSync(globalCssPath, survivingRules);
console.log(`\nFinished splitting CSS! Extracted ${extractedCount} rules, kept ${unmappedRules.length} rules in global.css.`);

function getFiles(dir, extArray) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(file, extArray));
        } else {
            if (extArray.some(ext => file.endsWith(ext))) {
                results.push(file);
            }
        }
    });
    return results;
}
