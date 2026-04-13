// pagare-docx.js — Pagaré DOCX generator v2
// keepNext headings, two-column signatures, 2-page optimized

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType
} = require('docx');

// ── Number to Spanish words ──────────────────────────────────────────────
const UNITS = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve'];
const TEENS = ['diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
const TENS  = ['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const HUND  = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];

function toWords(n) {
  if (n === 0) return 'cero';
  if (n === 100) return 'cien';
  var p = [];
  if (n >= 1e6) { var m = Math.floor(n/1e6); p.push(m===1?'un millón':toWords(m)+' millones'); n %= 1e6; }
  if (n >= 1e3) { var t = Math.floor(n/1e3); p.push(t===1?'mil':toWords(t)+' mil'); n %= 1e3; }
  if (n >= 100) { if (n===100){p.push('cien');n=0;} else {p.push(HUND[Math.floor(n/100)]);n%=100;} }
  if (n>=20) { if(n>20&&n<30){p.push('veinti'+UNITS[n-20]);n=0;} else {var t2=Math.floor(n/10),u=n%10;p.push(u?TENS[t2]+' y '+UNITS[u]:TENS[t2]);n=0;} }
  else if (n>=10) { p.push(TEENS[n-10]); n=0; }
  else if (n>0)   { p.push(UNITS[n]); }
  return p.join(' ').replace(/\s+/g,' ').trim();
}

function montoLetra(s) {
  var n = parseFloat(String(s).replace(/[^0-9.]/g,''))||0;
  var e = Math.floor(n), c = Math.round((n-e)*100);
  var w = toWords(e); w = w[0].toUpperCase()+w.slice(1);
  return w + ' pesos ' + String(c).padStart(2,'0') + '/100 M.N.';
}
function tasaLetra(t) {
  var n = parseFloat(t)||0, e = Math.floor(n), d = Math.round((n-e)*100);
  var w = toWords(e); w = w[0].toUpperCase()+w.slice(1);
  return d===0 ? w+' punto cero' : w+' punto '+toWords(d);
}
function numLetra(n) { var w=toWords(n); return w[0].toUpperCase()+w.slice(1); }

// ── Text helpers ─────────────────────────────────────────────────────────
var SZ = 19;
function B(t)  { return new TextRun({text:t, bold:true, font:'Arial', size:SZ}); }
function N(t)  { return new TextRun({text:t, font:'Arial', size:SZ}); }
function sB(t) { return new TextRun({text:t, bold:true, font:'Arial', size:17}); }
function sN(t) { return new TextRun({text:t, font:'Arial', size:17}); }

function heading(text) {
  return new Paragraph({ spacing:{before:180,after:60}, keepNext:true, children:[B(text)] });
}

// ── Build ────────────────────────────────────────────────────────────────
function buildPagare(data) {
  var ml = montoLetra(data.monto_pagare);
  var tl = tasaLetra(data.tasa);
  var na = data.amortizaciones ? data.amortizaciones.length : 0;
  var nal = numLetra(na).toLowerCase();
  var fechaStr = '';
  if (data.fecha) {
    var dt = new Date(data.fecha+'T12:00:00');
    fechaStr = dt.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
  }
  var tipoFull = 'CONTRATO DE APERTURA DE '+(data.tipo_credito||'').toUpperCase()
    +' hasta por la cantidad de '+(data.monto_credito||data.monto_pagare)
    +' M.N. (Son: '+montoLetra(data.monto_credito||data.monto_pagare)+').';

  var tb = {style:BorderStyle.SINGLE,size:1,color:'999999'};
  var bd = {top:tb,bottom:tb,left:tb,right:tb};
  var nb = {style:BorderStyle.NONE,size:0};
  var nbd = {top:nb,bottom:nb,left:nb,right:nb};

  // Info table
  var infoTable = new Table({
    width:{size:9800,type:WidthType.DXA}, columnWidths:[2200,7600],
    rows: [
      ['No de Contrato:', data.numero_contrato||''],
      ['Tipo de crédito:', tipoFull],
      ['Suscriptor(es):', (data.suscriptor||'').toUpperCase()],
      ['Domicilio:', data.domicilio||'']
    ].map(function(r){
      return new TableRow({children:[
        new TableCell({borders:bd,width:{size:2200,type:WidthType.DXA},margins:{top:40,bottom:40,left:60,right:60},children:[new Paragraph({children:[B(r[0])]})]}),
        new TableCell({borders:bd,width:{size:7600,type:WidthType.DXA},margins:{top:40,bottom:40,left:60,right:60},children:[new Paragraph({children:[B(r[1])]})]})
      ]});
    })
  });

  var body = [];

  // Main promise
  body.push(new Paragraph({spacing:{before:160,after:140},children:[
    N('El Suscriptor por este pagaré promete incondicionalmente pagar a la orden de PROAKTIVA, S.A.P.I. DE C.V., SOFOM, E.N.R., (en adelante PROAKTIVA), en la oficina ubicada en Calzada Gómez Morín 901 Interior 12 Colonia Rivera C.P. 21259 de la ciudad de Mexicali, Baja California, la suma de '),
    B(data.monto_pagare+' M.N. (Son: '+ml+')'),
    N(', mediante '), B(na+' ('+nal+')'),
    N(' amortización(es), por el(los) monto(s) y en la(s) fecha(s) que se indica(n) en la Tabla de amortizaciones detallada en este pagare. El suscriptor se obliga igualmente a pagar los intereses que se generen a razón de la tasa correspondiente a:')
  ]}));

  // TASA ORDINARIA
  body.push(heading('TASA ORDINARIA'));
  if (data.tipo_tasa==='tiie') {
    body.push(new Paragraph({spacing:{after:80},children:[
      N('El Suscriptor se obliga incondicionalmente a pagar a PROAKTIVA, el último día del "Período de Intereses" respectivo, desde la fecha de suscripción y hasta la fecha de vencimiento de este pagaré, intereses ordinarios sobre el saldo insoluto de este pagaré a razón de la tasa anual igual a la '),
      B('Tasa T.I.I.E. más '+data.tasa+'% ('+tl+') puntos porcentuales'), N('.')
    ]}));
    body.push(new Paragraph({spacing:{after:100},children:[
      N('Por Tasa de Interés Interbancaria de Equilibrio (T.I.I.E.) se entenderá el promedio aritmético de las cotizaciones diarias de la Tasa de Interés Interbancaria de Equilibrio a 28 días, publicadas por el Banco de México en el Diario Oficial de la Federación correspondientes al mes inmediato anterior a aquél en que se causen los intereses.')
    ]}));
  } else {
    body.push(new Paragraph({spacing:{after:100},children:[
      N('El Suscriptor se obliga incondicionalmente a pagar a PROAKTIVA, el último día del "Período de Intereses" respectivo, desde la fecha de suscripción y hasta la fecha de vencimiento de este pagaré, intereses ordinarios sobre el saldo insoluto de este pagaré a razón de la '),
      B('Tasa Fija anual de '+data.tasa+'% ('+tl+') puntos porcentuales'), N('.')
    ]}));
  }

  // TASA MORATORIA
  body.push(heading('TASA MORATORIA'));
  body.push(new Paragraph({spacing:{after:100},children:[N('En el caso de mora en el pago del saldo insoluto de este pagaré, la cantidad no pagada devengará intereses moratorios desde el día siguiente a la fecha de su vencimiento y hasta el día en que quede totalmente pagada, a razón de una tasa anual de interés moratorio igual a la Tasa Ordinaria establecida en este pagare, multiplicada por 2 (Dos), cantidad que el suscriptor se compromete incondicionalmente a pagar a PROAKTIVA.')]}));

  // PERIODO DE INTERESES
  body.push(heading('PERIODO DE INTERESES'));
  body.push(new Paragraph({spacing:{after:100},children:[N('Significa el lapso de tiempo con base en el cual se calcularán los intereses que devengue el saldo insoluto de este Pagaré, en el entendido que: (i) el primer "Período de Intereses" empezará en la fecha de suscripción del Pagaré y terminará el último día del mes calendario en que se suscribió este Pagaré y cada "Período de Intereses" subsiguiente comenzará el día siguiente al último día del "Período de Intereses" anterior y terminará el último día de cada mes calendario y así sucesivamente; (ii) Si la fecha de vencimiento de cualquier "Período de Intereses" cayere en un día que no fuere un día hábil, entonces dicho "Período de Intereses" terminará precisamente el día hábil inmediato anterior, sin que dicha extensión se tome en cuenta para efectos de cálculo de intereses. Lo anterior, en el entendido que los días que no sean tomados en cuenta para el cálculo de los intereses, se incluirán para el cálculo de intereses del "Periodo de Intereses" siguiente; (iii) Si la fecha de pago de principal cayere en un día que no fuere día hábil, dicho pago se hará y por lo tanto el "Período de intereses" terminará el siguiente día hábil y dicha extensión en el plazo se tomará en cuenta para efectos del cálculo de intereses; (iv) El último "Período de Intereses" terminará en la última fecha de pago de principal.')]}));
  body.push(new Paragraph({spacing:{after:100},children:[N('La cantidad antes citada se incrementará con el importe correspondiente a los financiamientos adicionales que PROAKTIVA otorgue al Suscriptor en los términos del Contrato que da origen al presente pagare, más los intereses que estos generen.')]}));

  // VENCIMIENTO ANTICIPADO
  body.push(heading('VENCIMIENTO ANTICIPADO'));
  body.push(new Paragraph({spacing:{after:80},children:[N('Las amortizaciones de este pagaré están numeradas del 1 al '+na+' y todos están sujetos a la condición de que al no pagarse cualquiera de ellas a su vencimiento harán que sean exigibles todas las que le sigan consecutivamente en número, además de las ya vencidas, ya que se darán por vencidas anticipadamente.')]}));
  body.push(new Paragraph({spacing:{after:80},children:[N('En lo no previsto en este pagaré se estará a lo pactado en el Contrato de crédito que se describe al margen superior izquierdo del presente contrato.')]}));

  // City, date, pages
  body.push(new Paragraph({spacing:{before:120,after:160},children:[
    N('Este pagaré se suscribe en la ciudad de '), B(data.ciudad||'Mexicali, Baja California'),
    N(', el día '+fechaStr+'. Va en '), B('2 (Dos)'), N(' paginas(s) tamaño carta.')
  ]}));

  // TABLA DE AMORTIZACION
  // keepNext heading + table with repeating headers
  if (data.amortizaciones && data.amortizaciones.length) {
    // Heading paragraph - keepNext forces it to the same page as the table
    body.push(new Paragraph({
      spacing:{before:180,after:0},
      keepNext: true,
      keepLines: true,
      children:[B('TABLA DE AMORTIZACION')]
    }));
    // Invisible bridge paragraph - chains keepNext into the table
    body.push(new Paragraph({
      spacing:{before:0,after:0},
      keepNext: true,
      children:[new TextRun({text:'', font:'Arial', size:2})]
    }));

    var cw = [900,4450,4450];
    var hdr = new TableRow({tableHeader:true, cantSplit:true, children:['No.','Fecha de vencimiento','Capital'].map(function(h,i){
      return new TableCell({borders:bd,width:{size:cw[i],type:WidthType.DXA},shading:{fill:'D5E8F0',type:ShadingType.CLEAR},margins:{top:30,bottom:30,left:50,right:50},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[sB(h)]})]});
    })});
    var rows = data.amortizaciones.map(function(r,i){
      return new TableRow({cantSplit:true, children:[String(i+1),r.fecha||'',r.capital||''].map(function(v,j){
        return new TableCell({borders:bd,width:{size:cw[j],type:WidthType.DXA},margins:{top:25,bottom:25,left:50,right:50},children:[new Paragraph({alignment:j===0?AlignmentType.CENTER:AlignmentType.LEFT,children:[sN(v)]})]});
      })});
    });
    body.push(new Table({width:{size:9800,type:WidthType.DXA},columnWidths:cw,rows:[hdr].concat(rows)}));
  }

  // ── SIGNATURES — Two-column layout ──────────────────────────────────────
  body.push(new Paragraph({spacing:{before:240},children:[]}));

  var avales = data.avales || [];
  var hw = 4900;

  function sigCell(label, name) {
    if (!label && !name) return new TableCell({borders:nbd,width:{size:hw,type:WidthType.DXA},children:[new Paragraph({children:[]})]});
    return new TableCell({
      borders:nbd, width:{size:hw,type:WidthType.DXA},
      margins:{top:20,bottom:20,left:0,right:60},
      children:[
        new Paragraph({children:[sB(label)]}),
        new Paragraph({spacing:{before:30},children:[sN('NOMBRE: '+name)]}),
        new Paragraph({spacing:{before:140},children:[sN('_________________________________')]}),
        new Paragraph({children:[sN(name)]}),
        new Paragraph({children:[sN('FIRMA')]})
      ]
    });
  }

  // Pair 1: Suscriptor (left) + first aval (right)
  var pairs = [];
  pairs.push([
    {label:'SUSCRIPTOR(ES):',name:(data.suscriptor||'').toUpperCase()},
    avales.length ? {label:'AVAL(ES):',name:avales[0].toUpperCase()} : null
  ]);
  // Remaining avales in pairs of 2
  for (var i=1; i<avales.length; i+=2) {
    pairs.push([
      {label:'AVAL(ES):',name:avales[i].toUpperCase()},
      (i+1<avales.length) ? {label:'AVAL(ES):',name:avales[i+1].toUpperCase()} : null
    ]);
  }

  pairs.forEach(function(pair){
    body.push(new Table({
      width:{size:9800,type:WidthType.DXA}, columnWidths:[hw,hw],
      rows:[new TableRow({children:[
        sigCell(pair[0].label, pair[0].name),
        pair[1] ? sigCell(pair[1].label, pair[1].name) : sigCell('','')
      ]})]
    }));
    body.push(new Paragraph({spacing:{before:40},children:[]}));
  });

  // ── Document
  return Packer.toBuffer(new Document({
    styles:{default:{document:{run:{font:'Arial',size:SZ}}}},
    sections:[{
      properties:{page:{
        size:{width:12240,height:15840},
        margin:{top:1000,right:1000,bottom:900,left:1200}
      }},
      children:[
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:140},children:[new TextRun({text:'PAGARE',bold:true,font:'Arial',size:24})]}),
        infoTable,
        ...body
      ]
    }]
  }));
}

module.exports = { buildPagare };
