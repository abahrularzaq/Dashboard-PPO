// Data yang diolah dari file Keluarga Bani Sidiq
const familyData = [
    { id: "sidiq", name: "SIDIQ & MUNAH", parent: null, level: "gen-0" },
    
    // Anak-anak (Generasi 1)
    { id: "dono", name: "DONO OETOMO", parent: "sidiq", level: "gen-1" },
    { id: "setyo", name: "SETYO", parent: "sidiq", level: "gen-1" },
    { id: "indasah", name: "SRI INDASAH", parent: "sidiq", level: "gen-1" },

    // Cucu dari Dono (Generasi 2)
    { id: "retno", name: "RETNO WULANDARI", parent: "dono", level: "gen-2" },
    { id: "himawan", name: "HIMAWAN LESDIYANTONO", parent: "dono", level: "gen-2" },

    // Cucu dari Setyo (Generasi 2)
    { id: "istiqomah", name: "ISTIQOMAH", parent: "setyo", level: "gen-2" },
    { id: "hidayah", name: "NURUL HIDAYAH", parent: "setyo", level: "gen-2" },

    // Cicit (Generasi 3)
    { id: "cheverly", name: "CHEVERLY GEVANDA", parent: "retno", level: "gen-3" },
    { id: "david", name: "DAVID ARYZDZAKY", parent: "retno", level: "gen-3" }
];

function buildTree(data, parentId = null) {
    const children = data.filter(item => item.parent === parentId);
    if (children.length === 0) return '';

    let html = '<ul>';
    children.forEach(child => {
        html += `
            <li>
                <div class="node ${child.level}">
                    ${child.name}
                </div>
                ${buildTree(data, child.id)}
            </li>
        `;
    });
    html += '</ul>';
    return html;
}

// Inisialisasi render
document.addEventListener("DOMContentLoaded", () => {
    const treeElement = document.getElementById('family-tree');
    treeElement.innerHTML = buildTree(familyData);
});