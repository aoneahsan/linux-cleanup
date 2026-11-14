/** The one theme control. */
export default {
  title: 'Appearance',
  axes: {
    theme: { legend: 'Appearance', system: 'Follow macOS', light: 'Light', dark: 'Dark' },
    palette: { legend: 'Colour treatment', jade: 'Harbor Jade', cobalt: 'Cobalt Night', brass: 'Warm Brass' },
    radius: { legend: 'Corners', none: 'Square', small: 'Small', medium: 'Medium', large: 'Large' },
    density: { legend: 'Density', compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' },
    typeScale: { legend: 'Text size', small: 'Small', medium: 'Medium', large: 'Large' },
    motion: { legend: 'Motion', system: 'Follow macOS', full: 'Full', reduced: 'Reduced' },
    sound: { legend: 'Sound', off: 'Off', on: 'Soft ticks' },
  },
  platePreview: '05',
} as const;
