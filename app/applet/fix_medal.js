import fs from 'fs';

const filePath = './src/pages/Profile.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const startKey = "Retornar ao Mural";
const idxStart = content.indexOf(startKey);

const endButtonKey = "</button>";
const idxOpenButtonEnd = content.indexOf(endButtonKey, idxStart);

const targetEndStr = "/* Medalhas de Honra (Gold/Silver Badge Wall) */";
const idxEnd = content.indexOf(targetEndStr);

if (idxStart !== -1 && idxOpenButtonEnd !== -1 && idxEnd !== -1) {
  console.log("Indexes found:", idxStart, idxOpenButtonEnd, idxEnd);
  
  const before = content.substring(0, idxOpenButtonEnd + endButtonKey.length);
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
  console.log("Could not find required indexes:", idxStart, idxOpenButtonEnd, idxEnd);
}
