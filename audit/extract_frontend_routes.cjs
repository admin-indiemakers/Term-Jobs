const fs = require('fs');
const content = fs.readFileSync('D:/projects/Term-Jobs/frontend/src/App.jsx', 'utf8');
const routes = [];
const regex = /<Route\s+([^>]+)>/g;
let match;
while ((match = regex.exec(content)) !== null) {
  const attrs = match[1];
  const pathMatch = attrs.match(/path=['"]([^'"]+)['"]/);
  const elementMatch = attrs.match(/element=\{([^}]+)\}/);
  const indexMatch = attrs.includes('index');
  routes.push({
    path: pathMatch ? pathMatch[1] : (indexMatch ? '(index)' : null),
    element: elementMatch ? elementMatch[1].trim() : null,
    raw: attrs.trim()
  });
}
console.log('Total frontend routes in App.jsx:', routes.length);
fs.writeFileSync('D:/projects/Term-Jobs/audit/frontend_routes_inventory.json', JSON.stringify(routes, null, 2));
console.log('Saved to audit/frontend_routes_inventory.json');

