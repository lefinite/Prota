/** Small dependency-free OOXML writer. Uses inline strings so input is never a formula. */
import {excelSheets} from './model.js';
const xml=value=>String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const utf8=new TextEncoder();
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function zip(files){
  const chunks=[],central=[];let offset=0;
  const header=(size,fields)=>{const bytes=new Uint8Array(size),v=new DataView(bytes.buffer);for(const [at,val,wide]of fields)wide?v.setUint32(at,val,true):v.setUint16(at,val,true);return bytes;};
  for(const [path,content]of Object.entries(files)){
    const name=utf8.encode(path),data=utf8.encode(content);let crc=0xffffffff;
    for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
    const h=header(30,[[0,0x04034b50,1],[4,20],[6,0x800],[14,crc,1],[18,data.length,1],[22,data.length,1],[26,name.length]]);
    const c=header(46,[[0,0x02014b50,1],[4,20],[6,20],[8,0x800],[16,crc,1],[20,data.length,1],[24,data.length,1],[28,name.length],[42,offset,1]]);
    chunks.push(h,name,data);central.push(c,name);offset+=h.length+name.length+data.length;
  }
  const centralSize=central.reduce((n,c)=>n+c.length,0);
  return new Blob([...chunks,...central,header(22,[[0,0x06054b50,1],[8,Object.keys(files).length],[10,Object.keys(files).length],[12,centralSize,1],[16,offset,1]])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
export function trackingWorkbook(manifest){
  const sheets=excelSheets(manifest),files={};
  files['[Content_Types].xml']=declaration+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  files['_rels/.rels']=declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  files['xl/workbook.xml']=declaration+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
  files['xl/_rels/workbook.xml.rels']=declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  files['xl/styles.xml']=declaration+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6254D9"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  for(const [index,sheet]of sheets.entries()){
    const last=String.fromCharCode(64+sheet.rows[0].length)+sheet.rows.length;
    files[`xl/worksheets/sheet${index+1}.xml`]=declaration+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${sheet.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${sheet.rows.map((row,r)=>{
      const lines=Math.max(...row.map((cell,c)=>String(cell).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil([...line].reduce((sum,ch)=>sum+(ch.charCodeAt(0)>255?2:1),0)/sheet.widths[c])),0)));
      return `<row r="${r+1}" ht="${r?Math.max(32,lines*16+10):32}" customHeight="1">${row.map((value,c)=>`<c r="${String.fromCharCode(65+c)}${r+1}" s="${r?0:1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`;
    }).join('')}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
  }
  return zip(files);
}
export function downloadTrackingWorkbook(manifest){
  const blob=trackingWorkbook(manifest),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`${manifest.scope.pageId}-${manifest.scope.version}-埋点.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
