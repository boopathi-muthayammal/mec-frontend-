import React from 'react';

function Watermark({ text }) {
  if (!text) return null;
  
  const encodedText = encodeURIComponent(text);
  const svgDataUri = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='350' height='250' viewBox='0 0 350 250'%3E%3Ctext x='20' y='120' fill='%23475569' font-size='15' font-family='Outfit, sans-serif' font-weight='500' transform='rotate(-25 20 120)' opacity='0.25'%3E${encodedText}%3C/text%3E%3C/svg%3E`;
  
  return (
    <div 
      className="global-watermark" 
      style={{ backgroundImage: `url("${svgDataUri}")` }}
    ></div>
  );
}

export default Watermark;
