import { classifyScans, ScanRecord } from '../rogueAp';

const scans: ScanRecord[] = [{
  deviceName: 'wAP ax',
  scannedAt: '2026-07-01T12:00:00Z',
  networks: [
    { ssid: 'TestNet', entries: [
      { bssid: 'D0:EA:11:0A:DE:78', signal: -30, band: '2.4 GHz' },        // our own radio
      { bssid: 'AA:BB:CC:DD:EE:01', signal: -55, band: '2.4 GHz', vendor: 'EvilCo' }, // evil twin!
    ]},
    { ssid: 'NeighborNet', security: 'WPA2', entries: [
      { bssid: 'AA:BB:CC:DD:EE:02', signal: -70, band: '5 GHz', vendor: 'Netgear' },
    ]},
    { ssid: '', hidden: true, entries: [
      { bssid: 'AA:BB:CC:DD:EE:03', signal: -80, band: '5 GHz' },
    ]},
  ],
}, {
  deviceName: 'Zanfibre-NW-100G',
  scannedAt: '2026-07-01T12:05:00Z',
  networks: [
    // Same evil twin seen stronger from another AP — should dedup, keep strongest
    { ssid: 'TestNet', entries: [{ bssid: 'AA:BB:CC:DD:EE:01', signal: -48, band: '2.4 GHz', vendor: 'EvilCo' }] },
  ],
}];

const ownSsids = new Set(['TestNet', 'IoT']);
const ownBssids = new Set(['d0:ea:11:0a:de:78', 'd0:ea:11:0a:de:79']);

describe('classifyScans', () => {
  const { rogues, neighbors } = classifyScans(scans, ownSsids, ownBssids);

  it('flags a foreign BSSID broadcasting our SSID as rogue (evil twin)', () => {
    expect(rogues).toHaveLength(1);
    expect(rogues[0].bssid).toBe('aa:bb:cc:dd:ee:01');
    expect(rogues[0].ssid).toBe('TestNet');
  });

  it('dedups across scanning devices, keeping the strongest sighting', () => {
    expect(rogues[0].signal).toBe(-48);
    expect(rogues[0].seenBy).toBe('Zanfibre-NW-100G');
  });

  it('ignores our own radios entirely', () => {
    const all = [...rogues, ...neighbors].map(x => x.bssid);
    expect(all).not.toContain('d0:ea:11:0a:de:78');
  });

  it('classifies foreign SSIDs as neighbors, hidden ones labelled', () => {
    expect(neighbors).toHaveLength(2);
    expect(neighbors[0].ssid).toBe('NeighborNet'); // stronger first
    expect(neighbors[1].ssid).toBe('(hidden)');
  });
});
