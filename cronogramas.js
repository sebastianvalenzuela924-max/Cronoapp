const CRONOGRAMAS = [
  {
    id: 'general',
    icon: '⚡',
    title: 'Corte de Energía',
    subtitle: 'Programa General · Áreas Comunes 2026',
    accent: '#4F46E5',
    getData: () => CRONO_DATA,
  },
  {
    id: 'electrico',
    icon: '🔌',
    title: 'Recuperación Eléctrica SF2',
    subtitle: 'Mantención Eléctrica · Recuperación Química',
    accent: '#0EA5E9',
    getData: () => CRONO_DATA_SF2_ELECTRICO,
  },
  {
    id: 'instrumentacion',
    icon: '📟',
    title: 'Recuperación Instrumentación SF2',
    subtitle: 'Mantención Instrumentación · Recuperación Química',
    accent: '#10B981',
    getData: () => CRONO_DATA_SF2_INSTRUMENTACION,
  },
];
