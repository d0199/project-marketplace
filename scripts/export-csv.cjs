const data = require('../data/gyms.json');
const fs = require('fs');

const rows = data.map(g => ({
  id: g.id,
  name: g.name,
  ownerId: g.ownerId,
  street: g.address ? g.address.street : '',
  suburb: g.address ? g.address.suburb : '',
  state: g.address ? g.address.state : '',
  postcode: g.address ? g.address.postcode : '',
  phone: g.phone || '',
  email: g.email || '',
  website: g.website || '',
  lat: g.lat != null ? g.lat : '',
  lng: g.lng != null ? g.lng : '',
  pricePerWeek: g.pricePerWeek != null ? g.pricePerWeek : '',
  amenities: (g.amenities || []).join('|'),
  isActive: g.isActive != null ? g.isActive : '',
  isFeatured: g.isFeatured != null ? g.isFeatured : '',
  isTest: g.isTest != null ? g.isTest : '',
  priceVerified: g.priceVerified != null ? g.priceVerified : '',
  imageCount: (g.images || []).length,
  description: g.description || ''
}));

const headers = Object.keys(rows[0]);

function escape(v) {
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const csv = [
  headers.join(','),
  ...rows.map(r => headers.map(h => escape(r[h])).join(','))
].join('\n');

fs.writeFileSync('./data/gyms_master.csv', csv);
console.log('Exported', rows.length, 'gyms to data/gyms_master.csv');
