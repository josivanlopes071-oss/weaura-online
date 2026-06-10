import fs from 'fs';

const filePath = './src/pages/Profile.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const s1 = "Retornar ao Mural\n                         </button>";
// It might end with CRLF
const s2 = "Retornar ao Mural\r\n                         </button>";

let idxStart = content.indexOf(s1);
if (idxStart === -1) {
  idxStart = content.indexOf(s2);
}

const targetEndStr = "/* Medalhas de Honra (Gold/Silver Badge Wall) */";
const idxEnd = content.indexOf(targetEndStr);

if (idxStart !== -1 && idxEnd !== -1) {
  console.log("Found both anchors!");
  
  // Keep everything up to the end of '</button>'
  const buttonLen = idxStart === content.indexOf(s1) ? s1.length : s2.length;
  const before = content.substring(0, idxStart + buttonLen);
  const after = content.substring(idxEnd);
  
  const replacement = `
                     </motion.div>
                  </>
               )}
            </AnimatePresence>

           `;
           
  fs.writeFileSync(filePath, before + replacement + after, 'utf8');
  console.log("Successfully replaced the block and matched layout!");
} else {
  console.log("Could not find start or end index:", idxStart, idxEnd);
}
