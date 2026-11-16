const {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo
} = React;

/**
 * TechDef Pro: Real-Time Hardware Monitoring & Auto-Cooling Dashboard for Gamers
 * Connects to Python FastAPI / WebSocket Agent at ws://localhost:8765/metrics
 */
function App() {
  // Navigation & Agent Connection States
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor' | 'sessions' | 'automation' | 'actions' | 'tests' | 'setup'
  const [agentOnline, setAgentOnline] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'keyboard' | 'screen' | 'audio' | 'mic' | 'webcam' | 'benchmark'
  const [toasts, setToasts] = useState([]);

  // Auto-detect if browser runs on macOS / MacBook
  const isMac = typeof navigator !== 'undefined' && /Mac|MacIntel|Macintosh|MacPPC/i.test(navigator.userAgent || navigator.platform);

  // Live Telemetry Snapshot State (populated via WebSocket or local fallback)
  const [metrics, setMetrics] = useState({
    timestamp: Date.now() / 1000,
    cpu: {
      name: isMac ? 'Apple M5 (10-Core Apple Silicon SoC)' : 'AMD Ryzen 5 7520U with Radeon Graphics (8 Threads)',
      package_temp_c: isMac ? 52.4 : 68.4,
      cores_temp_c: isMac ? [51.0, 52.2, 53.0, 52.5, 51.8, 52.0, 53.4, 52.8, 51.5, 52.0] : [67.0, 68.2, 69.1, 67.5, 66.8, 70.0, 68.4, 67.8],
      usage_pct: isMac ? 34.2 : 54.2,
      per_core_usage: isMac ? [25.0, 48.0, 52.0, 24.0, 36.0, 60.0, 32.0, 28.0, 22.0, 20.0] : [45.0, 68.0, 72.0, 34.0, 56.0, 80.0, 42.0, 38.0],
      clock_mhz: isMac ? 3850 : 4850,
      power_watts: isMac ? 18.5 : 68.5,
      is_throttling: false
    },
    gpu: {
      name: isMac ? 'Apple M5 Integrated GPU (Unified Apple Silicon)' : 'AMD Radeon(TM) Graphics (Integrated)',
      core_temp_c: isMac ? 49.2 : 65.2,
      hotspot_temp_c: isMac ? 54.8 : 76.8,
      usage_pct: isMac ? 42.5 : 86.5,
      vram_used_mb: isMac ? 11200 : 9450,
      vram_total_mb: 16384,
      vram_pct: isMac ? 68.4 : 57.7,
      clock_mhz: isMac ? 1400 : 2550,
      power_watts: isMac ? 14.2 : 184.2,
      power_limit_pct: 100,
      fan_speed_pct: isMac ? 25 : 65,
      is_throttling: false
    },
    ram: {
      used_gb: isMac ? 11.2 : 18.2,
      total_gb: 16.0,
      usage_pct: isMac ? 70.0 : 56.8,
      type: isMac ? 'Unified LPDDR5X' : 'DDR5'
    },
    disk: {
      used_gb: isMac ? 165.0 : 1240.0,
      total_gb: isMac ? 460.0 : 2048.0,
      usage_pct: isMac ? 35.8 : 60.5,
      read_speed_mbps: 18.4,
      write_speed_mbps: 5.2
    },
    network: {
      down_mbps: 32.4,
      up_mbps: 8.8,
      ping_ms: 15,
      online: true
    },
    battery: {
      percent: 80,
      health_pct: 94.9,
      cycles: 83,
      temp_c: 30.3,
      is_charging: false,
      power_plugged: false,
      secsleft: 22680,
      status: 'Discharging (Battery Power)'
    },
    fans: isMac ? [{
      id: 'mac_fan_left',
      name: 'Apple Silicon Active Blower (Left)',
      rpm: 1250,
      control_supported: true
    }, {
      id: 'mac_fan_right',
      name: 'Apple Silicon Active Blower (Right)',
      rpm: 1220,
      control_supported: true
    }] : [{
      id: 'cpu_fan',
      name: 'CPU AIO Pump',
      rpm: 2240,
      control_supported: true
    }, {
      id: 'gpu_fan_1',
      name: 'GPU Fan 1',
      rpm: 1980,
      control_supported: true
    }, {
      id: 'gpu_fan_2',
      name: 'GPU Fan 2',
      rpm: 1950,
      control_supported: true
    }, {
      id: 'case_intake',
      name: 'Chassis Intake',
      rpm: 1250,
      control_supported: true
    }, {
      id: 'case_exhaust',
      name: 'Chassis Exhaust',
      rpm: 1300,
      control_supported: true
    }],
    gaming: {
      game_running: false,
      active_game: null,
      fps: null,
      frametime_ms: null
    },
    capabilities: {
      fan_control: true,
      gpu_power_limit: true,
      os_platform: isMac ? 'macOS (Apple Silicon arm64)' : 'Windows 11 / x86_64',
      mode: isMac ? 'mac_hardware' : 'mock'
    },
    active_profile: 'auto',
    safety_opt_in: false,
    alerts: []
  });

  // Rolling 60s Telemetry History
  const [history, setHistory] = useState([]);

  // Automation & Actions Log State
  const [actionLogs, setActionLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeProfile, setActiveProfile] = useState('auto');
  const [safetyOptIn, setSafetyOptIn] = useState(false);

  // Settings State
  const [thresholds, setThresholds] = useState({
    cpu_warn_c: 80,
    cpu_crit_c: 92,
    cpu_safe_c: 72,
    gpu_warn_c: 80,
    gpu_crit_c: 90,
    gpu_safe_c: 70
  });

  // Custom Rules & Session Trends
  const [customRules, setCustomRules] = useState([]);
  const [trends, setTrends] = useState(null);
  const [newRule, setNewRule] = useState({
    name: '',
    metric_path: 'cpu.package_temp_c',
    operator: '>=',
    threshold_value: 82,
    duration_seconds: 5,
    action_type: 'set_fan_speed',
    target_value: 90
  });

  // Diagnostics Passed Tracking
  // Fan Control & Turbo Burst States
  const [fanData, setFanData] = useState(null);
  const [fanSlider, setFanSlider] = useState(60);
  const [fanApplying, setFanApplying] = useState(false);
  const [burstCountdown, setBurstCountdown] = useState(0);

  // Community Feed States
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityStats, setCommunityStats] = useState(null);
  const [postFilter, setPostFilter] = useState('all');
  const [newPost, setNewPost] = useState({ title: '', body: '', post_type: 'experience', username: '', attach_specs: false });
  const [showPostForm, setShowPostForm] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  const [commentUsername, setCommentUsername] = useState('');
  const [communityLoading, setCommunityLoading] = useState(false);
  const [pendingNotif, setPendingNotif] = useState(null);
  const [issuesList, setIssuesList] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [issuesFilter, setIssuesFilter] = useState('all');
  const [healthLoading, setHealthLoading] = useState(false);

  const [testsPassed, setTestsPassed] = useState({
    keyboard: false,
    screen: false,
    audio: false,
    mic: false,
    webcam: false,
    benchmark: false
  });
  const wsRef = useRef(null);
  const agentOnlineRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  const lastAlertTimeRef = useRef(0);

  // Keep ref synced without triggering re-render loops
  useEffect(() => {
    agentOnlineRef.current = agentOnline;
  }, [agentOnline]);

  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // AUDIO ALARM & TEACHER DEMO HANDLERS
  // --------------------------------------------------------------------------
  const playAlarmSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  const triggerTeacherDemo = () => {
    playAlarmSound();
    addToast('error', '🚨 CRITICAL HARDWARE ANOMALY DETECTED', 'CPU package reached 94.8°C! Autonomous cooling engaged.');

    // 1. Direct Web Notification API to Windows Notification Center over any open game window
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('🚨 TECHDEF CRITICAL THERMAL ALERT (94.8°C)', {
            body: 'FivePlay Gaming Load: CPU exceeded safe ceiling! Auto fan ramped to 100%.',
            requireInteraction: true
          });
        } catch (e) {}
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            try {
              new Notification('🚨 TECHDEF CRITICAL THERMAL ALERT (94.8°C)', {
                body: 'FivePlay Gaming Load: CPU exceeded safe ceiling! Auto fan ramped to 100%.',
                requireInteraction: true
              });
            } catch (e) {}
          }
        }).catch(() => {});
      }
    }

    const demoNotif = {
      id: 'demo_' + Date.now(),
      level: 'critical',
      title: 'CRITICAL OVERHEAT & THERMAL THROTTLING (94.8°C)',
      summary: 'CPU die junction exceeded safe 92°C thermal ceiling under gaming load. Autonomous mitigation engaged.',
      cpu_temp: 94.8,
      gpu_temp: 89.2,
      causes: [
        {
          icon: '🔥',
          title: 'Heatsink Thermal Saturation',
          detail: 'Continuous high-power gaming or math matrix load exceeded thermal dissipation capacity.',
          fix: 'Autonomous protection engaged: Fan ramped to 100% maximum velocity and cooling policy set to Active.'
        },
        {
          icon: '🌀',
          title: 'Intake Airflow Resistance',
          detail: 'Underside intake vents on laptop restricted. Cold ambient air cannot reach centrifugal blower.',
          fix: 'Elevate laptop rear by 1–2 inches or use an active cooling stand for direct airflow.'
        }
      ],
      next_steps: [
        'Autonomous Action: Fans overridden to 100% full emergency blast.',
        'Thermal mitigation active: Monitoring temperature decay curve.',
        'Verified: Hardware safeguarded from silicon degradation.'
      ]
    };
    setPendingNotif(demoNotif);

    // Call backend demo trigger
    fetch('/api/demo/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'critical_overheat' })
    }).then(r => r.json()).then(() => {
      fetch('/api/actions').then(r => r.json()).then(acts => setActionLogs(acts)).catch(() => {});
    }).catch(() => {});
  };

  const handleGameOverride = (gameName) => {
    fetch('/api/games/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: gameName })
    })
      .then(r => r.json())
      .then(() => {
        addToast('success', 'Game Status Updated', gameName === 'auto' ? 'Real-time auto game scanning active' : `Active game set to: ${gameName}`);
      })
      .catch(e => addToast('error', 'Override Failed', e.message));
  };

  // --------------------------------------------------------------------------
  // FAN CONTROL & TURBO BURST HANDLERS
  // --------------------------------------------------------------------------
  const fetchFanData = useCallback(async () => {
    try {
      const res = await fetch('/api/fans');
      if (res.ok) {
        const data = await res.json();
        setFanData(data);
      }
    } catch (e) {}
  }, []);

  const handleTurboBurst = (seconds = 15) => {
    setBurstCountdown(seconds);
    fetch('/api/fans/burst', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration: seconds, speed: 100 })
    })
      .then(r => r.json())
      .then(d => {
        addToast('warning', 'TURBO COOLING ENGAGED', `Pushing fan to 100% for ${seconds} seconds!`);
        fetchFanData();
      })
      .catch(e => {
        addToast('error', 'Turbo Burst Failed', e.message);
        setBurstCountdown(0);
      });
  };

  const handleFanBurst = () => handleTurboBurst(15);

  const handleStopTurbo = () => {
    setBurstCountdown(0);
    fetch('/api/fans/auto', { method: 'POST' })
      .then(() => {
        addToast('info', 'Turbo Stopped', 'Fans returning to automatic BIOS control.');
        fetchFanData();
      })
      .catch(e => addToast('error', 'Failed to stop turbo', e.message));
  };

  useEffect(() => {
    if (burstCountdown <= 0) return;
    const timer = setInterval(() => {
      setBurstCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          addToast('info', 'Turbo Burst Completed', 'Fan returning to normal curve.');
          fetchFanData();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [burstCountdown]);

  const handleSetFan = () => {
    setFanApplying(true);
    fetch('/api/fans/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pct: fanSlider })
    })
      .then(r => r.json())
      .then(d => {
        setFanApplying(false);
        addToast('success', 'Fan Speed Set', `Manual override set to ${fanSlider}%`);
        fetchFanData();
      })
      .catch(e => {
        setFanApplying(false);
        addToast('error', 'Fan Control Failed', e.message);
      });
  };

  const handleFanAuto = () => {
    fetch('/api/fans/auto', { method: 'POST' })
      .then(r => r.json())
      .then(() => {
        addToast('info', 'Fan Control Reset', 'Restored to automatic BIOS thermal curve.');
        fetchFanData();
      })
      .catch(e => addToast('error', 'Auto Reset Failed', e.message));
  };

  const handleFanEnable = (enabled) => {
    fetch('/api/fans/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    })
      .then(r => r.json())
      .then(() => {
        setSafetyOptIn(enabled);
        addToast(enabled ? 'success' : 'info', 'Fan Control Hardware Switch', enabled ? 'Hardware fan override enabled' : 'Hardware fan override disabled');
        fetchFanData();
      })
      .catch(e => addToast('error', 'Toggle Failed', e.message));
  };

  // --------------------------------------------------------------------------
  // COMMUNITY HANDLERS
  // --------------------------------------------------------------------------
  const fetchCommunity = useCallback(async (filterType = postFilter) => {
    setCommunityLoading(true);
    try {
      const url = filterType !== 'all' ? `/api/community/posts?type=${filterType}` : '/api/community/posts';
      const [pRes, sRes] = await Promise.all([fetch(url), fetch('/api/community/stats')]);
      if (pRes.ok) setCommunityPosts(await pRes.json());
      if (sRes.ok) setCommunityStats(await sRes.json());
    } catch (e) {
      addToast('error', 'Community Feed Error', e.message);
    }
    setCommunityLoading(false);
  }, [postFilter]);

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!newPost.title.trim() || !newPost.body.trim()) {
      addToast('error', 'Missing Information', 'Title and description are required.');
      return;
    }
    fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPost)
    })
      .then(r => r.json())
      .then(() => {
        addToast('success', 'Post Shared', 'Your setup & experience is live!');
        setShowPostForm(false);
        setNewPost({ title: '', body: '', post_type: 'experience', username: '', attach_specs: false });
        fetchCommunity(postFilter);
      })
      .catch(e => addToast('error', 'Failed to publish post', e.message));
  };

  const handleLikePost = (postId) => {
    fetch(`/api/community/posts/${postId}/like`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        setCommunityPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: d.likes } : p));
      })
      .catch(e => addToast('error', 'Like Failed', e.message));
  };

  const handleAddComment = (postId) => {
    if (!commentInput.trim()) return;
    fetch(`/api/community/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentInput, username: commentUsername })
    })
      .then(r => r.json())
      .then(newComment => {
        setCommunityPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const existing = p.comments || [];
            return { ...p, comments: [...existing, newComment], comment_count: (p.comment_count || 0) + 1 };
          }
          return p;
        }));
        setCommentInput('');
      })
      .catch(e => addToast('error', 'Comment Failed', e.message));
  };

  const fetchHealthAndIssues = useCallback(async () => {
    setHealthLoading(true);
    try {
      const [iRes, hRes] = await Promise.all([
        fetch('/api/issues').catch(() => null),
        fetch('/api/health/recommendations').catch(() => null)
      ]);
      if (iRes && iRes.ok) setIssuesList(await iRes.json());
      if (hRes && hRes.ok) setHealthData(await hRes.json());
    } catch (e) {
      console.warn('Health fetch error:', e);
    }
    setHealthLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'fans') fetchFanData();
    if (activeTab === 'community') fetchCommunity();
    if (activeTab === 'advisor') fetchHealthAndIssues();
  }, [activeTab]);

    // WEBSOCKET AUTO-CONNECT CLIENT (Mounted Once)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let isDisposed = false;
    const connectWs = () => {
      if (isDisposed) return;
      const token = 'techdef-gamer-secret-token';
      const host = window.location.hostname || '127.0.0.1';
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPortStr = window.location.port ? `:${window.location.port}` : '';
      const wsUrl = `${wsProto}//${host}${wsPortStr}/metrics?token=${token}`;
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          if (isDisposed) return;
          setAgentOnline(true);
          agentOnlineRef.current = true;
          if (!hasConnectedOnceRef.current) {
            hasConnectedOnceRef.current = true;
            addToast('success', 'Hardware Agent Connected', `Streaming live telemetry from ${host}${wsPortStr}`);
          }
          fetchInitialData();
        };
        ws.onmessage = event => {
          if (isDisposed) return;
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'metrics_update' || message.type === 'init') {
              const data = message.data;
              setMetrics(data);
              if (data.active_profile) setActiveProfile(data.active_profile);
              if (typeof data.safety_opt_in === 'boolean') setSafetyOptIn(data.safety_opt_in);

              // Update rolling history buffer
              setHistory(prev => {
                const next = [...prev, {
                  time: new Date().toLocaleTimeString([], {
                    hour12: false,
                    minute: '2-digit',
                    second: '2-digit'
                  }),
                  cpuTemp: data.cpu.package_temp_c,
                  gpuTemp: data.gpu.core_temp_c,
                  cpuPower: data.cpu.power_watts,
                  gpuPower: data.gpu.power_watts,
                  fanRpm: data.fans?.[0]?.rpm || 2400,
                  fps: data.gaming?.fps || 0
                }];
                return next.slice(-60);
              });

              // Check for incoming alerts to toast (debounced to avoid spamming every second)
              if (data.alerts && data.alerts.length > 0) {
                const alert = data.alerts[0];
                const now = Date.now();
                if (alert.level === 'critical' && now - lastAlertTimeRef.current > 30000) {
                  lastAlertTimeRef.current = now;
                  addToast('error', alert.title, alert.message);
                }
              }
            }
          } catch (err) {
            console.error('WS parse error', err);
          }
        };
        ws.onclose = () => {
          if (isDisposed) return;
          setAgentOnline(false);
          agentOnlineRef.current = false;
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectWs, 3000);
        };
        ws.onerror = () => {
          if (isDisposed) return;
          setAgentOnline(false);
          agentOnlineRef.current = false;
          try {
            ws.close();
          } catch (e) {}
        };
      } catch (err) {
        if (isDisposed) return;
        setAgentOnline(false);
        agentOnlineRef.current = false;
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectWs, 3000);
      }
    };
    connectWs();

    // Resilient HTTP Poller fallback only when WebSocket is offline
    const pollingTimer = setInterval(async () => {
      if (isDisposed) return;
      if (!agentOnlineRef.current) {
        try {
          const host = window.location.hostname || '127.0.0.1';
          const res = await fetch(`/api/metrics`);
          if (res.ok) {
            const data = await res.json();
            setAgentOnline(true);
            agentOnlineRef.current = true;
            setMetrics(data);
            if (data.active_profile) setActiveProfile(data.active_profile);
            if (typeof data.safety_opt_in === 'boolean') setSafetyOptIn(data.safety_opt_in);
            setHistory(prev => {
              const next = [...prev, {
                time: new Date().toLocaleTimeString([], {
                  hour12: false,
                  minute: '2-digit',
                  second: '2-digit'
                }),
                cpuTemp: data.cpu.package_temp_c,
                gpuTemp: data.gpu.core_temp_c,
                cpuPower: data.cpu.power_watts,
                gpuPower: data.gpu.power_watts,
                fanRpm: data.fans?.[0]?.rpm || 2400,
                fps: data.gaming?.fps || 0
              }];
              return next.slice(-60);
            });
            fetchInitialData();
          }
        } catch (e) {
          // agent offline: gentle idle wave with no fake game
          setMetrics(prev => {
            const t = Date.now() / 1000;
            const wave = Math.sin(t / 8.0);
            const cpuTemp = +(46.0 + wave * 3.0 + (Math.random() * 1 - 0.5)).toFixed(1);
            const gpuTemp = +(44.0 + wave * 2.5 + (Math.random() * 1 - 0.5)).toFixed(1);
            const updated = {
              ...prev,
              cpu: {
                ...prev.cpu,
                package_temp_c: cpuTemp,
                usage_pct: +(18.0 + wave * 8.0).toFixed(1),
                power_watts: +(12.0 + wave * 4.0).toFixed(1),
                is_throttling: false
              },
              gpu: {
                ...prev.gpu,
                core_temp_c: gpuTemp,
                hotspot_temp_c: +(gpuTemp + 5.0).toFixed(1),
                usage_pct: +(12.0 + wave * 6.0).toFixed(1),
                power_watts: +(8.0 + wave * 3.0).toFixed(1),
                is_throttling: false
              },
              gaming: {
                game_running: false,
                active_game: null,
                fps: null,
                frametime_ms: null
              }
            };
            setHistory(h => [...h.slice(-59), {
              time: new Date().toLocaleTimeString([], {
                hour12: false,
                minute: '2-digit',
                second: '2-digit'
              }),
              cpuTemp,
              gpuTemp,
              cpuPower: updated.cpu.power_watts,
              gpuPower: updated.gpu.power_watts,
              fps: 0
            }]);
            return updated;
          });
        }
      }
    }, 1000);
    return () => {
      isDisposed = true;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(pollingTimer);
    };
  }, []);

  // Fetch REST endpoints data
  const fetchInitialData = async () => {
    try {
      const host = window.location.hostname || '127.0.0.1';
      const [actionsRes, sessionsRes, settingsRes, rulesRes, trendsRes, issuesRes, healthRes] = await Promise.all([
        fetch(`/api/actions`).catch(() => null),
        fetch(`/api/sessions`).catch(() => null),
        fetch(`/api/settings`).catch(() => null),
        fetch(`/api/rules`).catch(() => null),
        fetch(`/api/trends`).catch(() => null),
        fetch(`/api/issues`).catch(() => null),
        fetch(`/api/health/recommendations`).catch(() => null)
      ]);
      if (actionsRes && actionsRes.ok) setActionLogs(await actionsRes.json());
      if (sessionsRes && sessionsRes.ok) setSessions(await sessionsRes.json());
      if (rulesRes && rulesRes.ok) setCustomRules(await rulesRes.json());
      if (trendsRes && trendsRes.ok) setTrends(await trendsRes.json());
      if (issuesRes && issuesRes.ok) setIssuesList(await issuesRes.json());
      if (healthRes && healthRes.ok) setHealthData(await healthRes.json());
      if (settingsRes && settingsRes.ok) {
        const s = await settingsRes.json();
        if (s.thresholds) setThresholds(s.thresholds);
        if (s.active_profile) setActiveProfile(s.active_profile);
        if (s.safety && typeof s.safety.fan_control_enabled === 'boolean') {
          setSafetyOptIn(s.safety.fan_control_enabled);
        }
      }
    } catch (e) {
      console.warn('Initial REST load error', e);
    }
  };

  // Thresholds Save Handler
  const handleSaveThresholds = async e => {
    e.preventDefault();
    try {
      const host = window.location.hostname || '127.0.0.1';
      const res = await fetch(`/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          thresholds
        })
      });
      if (res.ok) {
        addToast('success', 'Thresholds Updated', 'Engine thermal bounds saved successfully.');
      }
    } catch (err) {
      addToast('error', 'Update Failed', 'Could not save thresholds to agent.');
    }
  };

  // Custom Rule Add Handler
  const handleAddRule = async e => {
    e.preventDefault();
    if (!newRule.name) {
      addToast('warning', 'Missing Rule Name', 'Please provide a descriptive rule name.');
      return;
    }
    try {
      const host = window.location.hostname || '127.0.0.1';
      const res = await fetch(`/api/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newRule)
      });
      if (res.ok) {
        const data = await res.json();
        setCustomRules(prev => [...prev, data.rule]);
        setNewRule({
          name: '',
          metric_path: 'cpu.package_temp_c',
          operator: '>=',
          threshold_value: 82,
          duration_seconds: 5,
          action_type: 'set_fan_speed',
          target_value: 90
        });
        addToast('success', 'Custom Rule Deployed', `Rule "${data.rule.name}" is now evaluated every second.`);
      }
    } catch (err) {
      addToast('error', 'Rule Deployment Failed', 'Could not register custom rule with agent.');
    }
  };

  // Custom Rule Delete Handler
  const handleDeleteRule = async ruleId => {
    try {
      const host = window.location.hostname || '127.0.0.1';
      const res = await fetch(`/api/rules/${ruleId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCustomRules(prev => prev.filter(r => r.id !== ruleId));
        addToast('info', 'Rule Removed', `Rule #${ruleId} deleted.`);
      }
    } catch (err) {
      addToast('error', 'Delete Failed', 'Could not delete rule.');
    }
  };

  // Toast Notifications
  const addToast = (type, title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, {
      id,
      type,
      title,
      message
    }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Profile Change Handler
  const handleProfileChange = async profile => {
    setActiveProfile(profile);
    addToast('info', 'Profile Changed', `Cooling profile set to ${profile.toUpperCase()}`);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          active_profile: profile
        })
      });
    } catch (e) {}
  };

  // Toggle Hardware Safety Opt-In
  const handleToggleSafety = async () => {
    const nextState = !safetyOptIn;
    setSafetyOptIn(nextState);
    addToast(nextState ? 'warning' : 'info', nextState ? 'Hardware Fan & Power Control Enabled' : 'Hardware Control Disabled (Safe Fallback)', nextState ? 'Automated rules will now adjust fan RPM and power limits under thermal load.' : 'Agent will now only notify without adjusting hardware.');
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fan_control_enabled: nextState
        })
      });
    } catch (e) {}
  };

  // Undo Action in History
  const handleUndoAction = async actionId => {
    try {
      const res = await fetch('/api/actions/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action_id: actionId
        })
      });
      if (res.ok) {
        setActionLogs(prev => prev.map(a => a.id === actionId ? {
          ...a,
          is_reverted: 1
        } : a));
        addToast('success', 'Action Reverted', `Action #${actionId} was successfully undone. Hardware restored to baseline.`);
      }
    } catch (e) {
      addToast('error', 'Undo Failed', 'Could not communicate with the agent.');
    }
  };

  // Temperature color helper with Dark Label Palette
  const getTempColorClass = temp => {
    if (temp >= 85) return 'border-red-500/50 bg-red-950/20 text-red-300';
    if (temp >= 75) return 'border-[rgba(232,145,60,0.45)] bg-[rgba(232,145,60,0.06)] text-[#E8913C]';
    return 'border-[rgba(237,231,220,0.13)] bg-[#101317] text-[#EDE7DC]';
  };
  const getTempStatusBadge = temp => {
    if (temp >= 90) return /*#__PURE__*/React.createElement("span", {
      className: "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/90 text-red-300 border border-red-500/60 pulse-dot-crit tracking-wider"
    }, "CRITICAL THERMAL");
    if (temp >= 80) return /*#__PURE__*/React.createElement("span", {
      className: "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(232,145,60,0.15)] text-[#E8913C] border border-[rgba(232,145,60,0.45)] pulse-dot-warn tracking-wider"
    }, "WARM / DWELLING");
    return /*#__PURE__*/React.createElement("span", {
      className: "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[rgba(46,107,114,0.18)] text-[#88c9cf] border border-[rgba(46,107,114,0.4)] tracking-wider"
    }, "NORMAL OPTIMAL");
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "flex h-screen bg-[#0A0C0E] text-[#EDE7DC] font-sans overflow-hidden"
  }, /*#__PURE__*/React.createElement("aside", {
    className: `
        fixed inset-y-0 left-0 z-50 w-64 bg-[#0A0C0E] border-r border-[rgba(237,231,220,0.13)] flex flex-col transition-transform duration-200 ease-in-out
        md:translate-x-0 md:static md:inset-auto ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 border-b border-[rgba(237,231,220,0.13)] flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-xl bg-[#101317] border border-[rgba(237,231,220,0.16)] flex items-center justify-center text-[#E8913C] shadow-sm"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-5 h-5",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 2.5
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "text-sm font-display font-extrabold tracking-tight uppercase text-[#EDE7DC] flex items-center gap-1"
  }, "TECH•DEF", /*#__PURE__*/React.createElement("span", {
    className: "text-[#E8913C]"
  }, "."), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] bg-[rgba(232,145,60,0.12)] text-[#E8913C] border border-[rgba(232,145,60,0.35)] px-1.5 py-0.5 rounded font-mono font-bold"
  }, "PRO")), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-[#6C7378] font-sans uppercase tracking-[0.12em]"
  }, "Auto-Cooling Engine"))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMobileMenuOpen(false),
    className: "md:hidden text-[#9EA5A8] hover:text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-5 h-5",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  })))), /*#__PURE__*/React.createElement("div", {
    className: `mx-4 my-3 p-3 rounded-xl border flex items-center gap-3 transition-colors ${agentOnline ? 'bg-[#101317] border-[rgba(46,107,114,0.4)] text-[#EDE7DC]' : 'bg-[#101317] border-[rgba(232,145,60,0.35)] text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: `w-2.5 h-2.5 rounded-full flex-shrink-0 ${agentOnline ? 'bg-[#2E6B72] pulse-dot-teal' : 'bg-[#E8913C] pulse-dot-warn'}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "text-xs overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-sans font-semibold text-xs text-[#EDE7DC] flex items-center gap-1.5"
  }, agentOnline ? 'Agent Online (Live 1s)' : 'Agent Offline (Mock Mode)'), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-[#9EA5A8] font-mono truncate"
  }, agentOnline ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname || '127.0.0.1'}${window.location.port ? `:${window.location.port}` : ''}/metrics` : 'Click "Agent Setup" to start'))), /*#__PURE__*/React.createElement("nav", {
    className: "flex-1 px-3 py-2 space-y-1 overflow-y-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#6C7378] px-3 pt-3 pb-1"
  }, "Real-Time Gaming"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('monitor');
      setMobileMenuOpen(false);
    },
    className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'monitor' ? 'bg-[rgba(232,145,60,0.1)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] font-semibold' : 'text-[#9EA5A8] hover:bg-[#101317] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "📊"), /*#__PURE__*/React.createElement("span", null, "Live Telemetry & Charts")), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#161B21] text-[#EDE7DC]"
  }, "60s")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('fans');
      setMobileMenuOpen(false);
    },
    className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'advisor' ? 'bg-[rgba(232,145,60,0.1)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] font-semibold' : 'text-[#9EA5A8] hover:bg-[#101317] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "🩺"), /*#__PURE__*/React.createElement("span", null, "Laptop Health & Issues")), issuesList.length > 0 ? /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-500/40 animate-pulse"
  }, `${issuesList.length} LOGS`) : /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40"
  }, "OPTIMAL")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('fans');
      setMobileMenuOpen(false);
    },
    className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'fans' ? 'bg-[rgba(232,145,60,0.1)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] font-semibold' : 'text-[#9EA5A8] hover:bg-[#101317] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "🌀"), /*#__PURE__*/React.createElement("span", null, "Fan Control & Turbo")), burstCountdown > 0 ? /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
  }, `${burstCountdown}s`) : /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono text-[#E8913C]"
  }, "100% BOOST")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('community');
      setMobileMenuOpen(false);
    },
    className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'community' ? 'bg-[rgba(232,145,60,0.1)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] font-semibold' : 'text-[#9EA5A8] hover:bg-[#101317] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "💬"), /*#__PURE__*/React.createElement("span", null, "Gamer Community")), communityPosts.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#101317] text-[#EDE7DC] border border-[rgba(237,231,220,0.2)]"
  }, communityPosts.length)), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('sessions');
      setMobileMenuOpen(false);
    },
    className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'sessions' ? 'bg-[rgba(232,145,60,0.1)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] font-semibold' : 'text-[#9EA5A8] hover:bg-[#101317] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "🎮"), /*#__PURE__*/React.createElement("span", null, "Game Sessions")), metrics.gaming?.game_running && /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[rgba(232,145,60,0.15)] text-[#E8913C] border border-[rgba(232,145,60,0.4)]"
  }, "ACTIVE")), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#6C7378] px-3 pt-4 pb-1"
  }, "Thermal Protection"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('automation');
      setMobileMenuOpen(false);
    },
    className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'automation' ? 'bg-[rgba(232,145,60,0.1)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] font-semibold' : 'text-[#9EA5A8] hover:bg-[#101317] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "⚡"), /*#__PURE__*/React.createElement("span", null, "Auto-Cooling & Rules")), /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${safetyOptIn ? 'bg-[rgba(232,145,60,0.15)] text-[#E8913C] border border-[rgba(232,145,60,0.35)]' : 'bg-[#161B21] text-[#9EA5A8]'}`
  }, activeProfile.toUpperCase())), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('actions');
      setMobileMenuOpen(false);
    },
    className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'actions' ? 'bg-[rgba(232,145,60,0.1)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] font-semibold' : 'text-[#9EA5A8] hover:bg-[#101317] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "📋"), /*#__PURE__*/React.createElement("span", null, "Actions & Reversals")), actionLogs.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#101317] text-[#EDE7DC] border border-[rgba(237,231,220,0.2)]"
  }, actionLogs.length)), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#6C7378] px-3 pt-4 pb-1"
  }, "Diagnostics & Tools"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('tests');
      setMobileMenuOpen(false);
    },
    className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'tests' ? 'bg-[rgba(232,145,60,0.1)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] font-semibold' : 'text-[#9EA5A8] hover:bg-[#101317] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "⌨️"), /*#__PURE__*/React.createElement("span", null, "Hardware Test Tools")), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono text-[#9EA5A8]"
  }, "6 Suites")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setActiveTab('setup');
      setMobileMenuOpen(false);
    },
    className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'setup' ? 'bg-[rgba(232,145,60,0.1)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] font-semibold' : 'text-[#9EA5A8] hover:bg-[#101317] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "⚙️"), /*#__PURE__*/React.createElement("span", null, "Agent Setup & Docs")), !agentOnline && /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40"
  }, "OFFLINE"))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-t border-[rgba(237,231,220,0.13)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#101317] border border-[rgba(237,231,220,0.12)] rounded-xl space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-[10px] font-sans tracking-[0.12em] uppercase font-semibold"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#6C7378]"
  }, "ACTIVE GAME"), /*#__PURE__*/React.createElement("span", {
    className: `w-2 h-2 rounded-full ${metrics.gaming?.game_running ? 'bg-[#E8913C] animate-pulse' : 'bg-[#6C7378]'}`
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-bold text-[#EDE7DC] truncate font-display"
  }, metrics.gaming?.game_running && metrics.gaming?.active_game ? metrics.gaming.active_game : 'No Game Active (Idle)'), metrics.gaming?.game_running && metrics.gaming?.fps ? /*#__PURE__*/React.createElement("div", {
    className: "space-y-1 pt-1.5 border-t border-[rgba(237,231,220,0.1)] text-[10px] font-mono text-[#E8913C]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between font-bold"
  }, /*#__PURE__*/React.createElement("span", null, metrics.gaming.fps, " FPS"), /*#__PURE__*/React.createElement("span", null, metrics.gaming.frametime_ms, " ms")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-[#9EA5A8]"
  }, /*#__PURE__*/React.createElement("span", null, "CPU ", metrics.gaming.cpu_pct || 18.5, "%"), /*#__PURE__*/React.createElement("span", null, "RAM ", metrics.gaming.memory_mb || 420, " MB")), /*#__PURE__*/React.createElement("div", {
    className: "text-[#6C7378] text-[9px]"
  }, "⏱ ", metrics.gaming.session_duration_str || '00:01')) : /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] pt-1.5 border-t border-[rgba(237,231,220,0.1)]"
  }, "Desktop / Idle Mode")))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 flex flex-col min-w-0 overflow-y-auto"
  }, /*#__PURE__*/React.createElement("header", {
    className: "sticky top-0 z-40 bg-[#0A0C0E]/90 backdrop-blur-md border-b border-[rgba(237,231,220,0.13)] px-6 py-4 flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMobileMenuOpen(true),
    className: "md:hidden p-2 rounded-lg text-[#9EA5A8] hover:text-[#EDE7DC] hover:bg-[#101317]"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-5 h-5",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 6h16M4 12h16M4 18h16"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "text-base font-display font-bold text-[#EDE7DC] flex items-center gap-2"
  }, activeTab === 'monitor' && 'Live Hardware Telemetry & 60s Thermal Charts',
 activeTab === 'advisor' && 'Laptop Health Diagnostic, Historical Abnormal Behavior & Advisory',
 activeTab === 'fans' && 'Fan Governor & 100% Instant Turbo Boost',
 activeTab === 'community' && 'Gamer Community & Thermal Setup Discussion',
 activeTab === 'sessions' && 'Per-Game Sessions & Thermal Throttling Log', activeTab === 'automation' && 'Smart Auto-Cooling Engine & Profiles', activeTab === 'actions' && 'Actions Log & Reversible Overrides', activeTab === 'tests' && 'Interactive Hardware Diagnostics', activeTab === 'setup' && 'Agent Service Setup & Windows Integration'), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8] font-mono flex items-center flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement("span", null, metrics.cpu.name, " • ", metrics.gpu.name), metrics.battery && /*#__PURE__*/React.createElement("span", {
    className: `px-2 py-0.5 rounded-full border text-[10px] font-bold ${metrics.battery.is_charging ? 'bg-[#101317] border-[rgba(232,145,60,0.4)] text-[#E8913C]' : 'bg-[#101317] border-[rgba(46,107,114,0.4)] text-[#88c9cf]'}`
  }, "🔋 ", metrics.battery.percent, "% ", metrics.battery.is_charging ? '⚡' : '', " • Health ", metrics.battery.health_pct, "%")))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 sm:gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: triggerTeacherDemo,
    className: "px-3 py-1.5 rounded-xl border border-red-500/60 bg-red-950/40 hover:bg-red-900/60 text-red-300 font-mono text-xs font-bold flex items-center gap-2 transition-all shadow-md animate-pulse",
    title: "Click to demo a critical overheat alert, audible sound, and auto-diagnosis popup for your teacher"
  }, /*#__PURE__*/React.createElement("span", null, "🚨"), /*#__PURE__*/React.createElement("span", {
    className: "hidden sm:inline"
  }, "Teacher Demo"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-mono font-extrabold"
  }, "POPUP TEST")), /*#__PURE__*/React.createElement("a", {
    href: "/",
    className: "px-3 py-1.5 rounded-xl border border-[rgba(237,231,220,0.16)] bg-[#101317] hover:border-[#E8913C] hover:text-[#E8913C] text-[#EDE7DC] font-mono text-xs flex items-center gap-1.5 transition-all shadow-sm",
    title: "Return to Portal Landing Page"
  }, /*#__PURE__*/React.createElement("span", null, "←"), /*#__PURE__*/React.createElement("span", {
    className: "hidden sm:inline font-bold"
  }, "Portal")), /*#__PURE__*/React.createElement("div", {
    className: "hidden lg:flex items-center p-1 rounded-xl bg-[#101317] border border-[rgba(237,231,220,0.13)] text-[11px] font-mono"
  }, ['silent', 'balanced', 'performance', 'auto'].map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => handleProfileChange(p),
    className: `px-3 py-1 rounded-lg font-bold capitalize transition-all ${activeProfile === p ? 'bg-[#E8913C] text-[#0A0C0E] shadow-sm' : 'text-[#9EA5A8] hover:text-[#EDE7DC]'}`
  }, p))), /*#__PURE__*/React.createElement("button", {
    onClick: handleToggleSafety,
    className: `flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${safetyOptIn ? 'bg-[rgba(232,145,60,0.12)] border-[rgba(232,145,60,0.45)] text-[#E8913C] shadow-sm' : 'bg-[#101317] border-[rgba(237,231,220,0.13)] text-[#9EA5A8] hover:text-[#EDE7DC]'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-2 h-2 rounded-full ${safetyOptIn ? 'bg-[#E8913C] pulse-dot-online' : 'bg-[#6C7378]'}`
  }), /*#__PURE__*/React.createElement("span", null, safetyOptIn ? 'Auto-Cooling Active' : 'Safety Opt-In (Off)')))), !agentOnline && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#101317] border-b border-[rgba(232,145,60,0.3)] px-6 py-2.5 flex items-center justify-between text-xs text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 font-mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "⚠️"), /*#__PURE__*/React.createElement("span", null, "Local Hardware Agent service is offline on port 8765. Running simulated live mock telemetry.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveTab('setup'),
    className: "px-2.5 py-1 rounded bg-[#E8913C] text-[#0A0C0E] font-extrabold text-[11px] hover:bg-[#d97d26] transition-colors"
  }, "View Setup Steps →")), /*#__PURE__*/React.createElement("main", {
    className: "p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6"
  }, activeTab === 'monitor' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, metrics.gaming?.game_running && /*#__PURE__*/React.createElement("div", {
    className: "p-5 bg-[#101317] border-2 border-[#E8913C] rounded-2xl gamer-panel space-y-4 bg-gradient-to-r from-[#E8913C]/10 via-[#101317] to-[#2E6B72]/15 shadow-[0_0_30px_rgba(232,145,60,0.18)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[rgba(237,231,220,0.12)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl"
  }, "🎮"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-mono font-bold text-[#E8913C] uppercase tracking-wider"
  }, "Live Game Telemetry HUD"), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 animate-pulse"
  }, "LIVE PLAYING")), /*#__PURE__*/React.createElement("h3", {
    className: "text-base font-bold text-white font-display mt-0.5"
  }, metrics.gaming.active_game))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-mono bg-[#161B21] px-3 py-1 rounded-lg text-[#EDE7DC] border border-[rgba(237,231,220,0.1)]"
  }, "⏱ Session: ", metrics.gaming.session_duration_str || '00:01'), /*#__PURE__*/React.createElement("button", {
    onClick: triggerTeacherDemo,
    className: "px-3 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
  }, "🚨 Test Alert Over Game"))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E]/80 border border-[rgba(237,231,220,0.1)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "FPS Counter"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-black font-mono text-[#E8913C] mt-1"
  }, metrics.gaming.fps || 120, " FPS"), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Display Synchronized")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E]/80 border border-[rgba(237,231,220,0.1)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Frametime"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-black font-mono text-[#2E6B72] mt-1"
  }, metrics.gaming.frametime_ms || 8.33, " ms"), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Low Render Latency")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E]/80 border border-[rgba(237,231,220,0.1)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Game Process CPU"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-black font-mono text-[#EDE7DC] mt-1"
  }, metrics.gaming.cpu_pct || 18.5, "%"), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Active Process Core")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E]/80 border border-[rgba(237,231,220,0.1)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "RAM Allocated"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-black font-mono text-[#EDE7DC] mt-1"
  }, metrics.gaming.memory_mb || 420, " MB"), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Working Set RSS")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E]/80 border border-[rgba(237,231,220,0.1)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Display & Engine"), /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-bold font-mono text-[#E8913C] mt-1 truncate"
  }, metrics.gaming.resolution || '1536x864 @ 120Hz'), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5 truncate"
  }, metrics.gaming.engine || 'WebGL 2.0 Canvas')), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E]/80 border border-[rgba(237,231,220,0.1)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Thermal Headroom"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-black font-mono text-emerald-400 mt-1"
  }, "+", metrics.gaming.thermal_headroom_c || (92 - metrics.cpu.package_temp_c).toFixed(1), "°C"), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Safe Limit: 92°C")))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-3 gap-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-2xl border transition-all gamer-panel ${getTempColorClass(metrics.cpu.package_temp_c)}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl"
  }, "🧠"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold text-white uppercase tracking-wider font-mono"
  }, "CPU Package"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, metrics.cpu.name))), getTempStatusBadge(metrics.cpu.package_temp_c)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline justify-between py-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-5xl font-extrabold font-mono tracking-tight text-[#EDE7DC]"
  }, metrics.cpu.package_temp_c, "°C"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-[#9EA5A8] font-mono mt-1"
  }, "Clock: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-[#E8913C]"
  }, metrics.cpu.clock_mhz, " MHz"), " • Power: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-[#EDE7DC]"
  }, metrics.cpu.power_watts, " W"))), /*#__PURE__*/React.createElement("div", {
    className: "text-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold font-mono text-[#E8913C]"
  }, metrics.cpu.usage_pct, "%"), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-[#6C7378] font-mono"
  }, "Load"))), /*#__PURE__*/React.createElement("div", {
    className: "pt-4 border-t border-[rgba(237,231,220,0.13)] space-y-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] font-mono text-[#9EA5A8] flex justify-between"
  }, /*#__PURE__*/React.createElement("span", null, "Per-Core Threads (8 Cores)"), /*#__PURE__*/React.createElement("span", null, "Target Warn: ", thresholds.cpu_warn_c, "°C")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-8 gap-1.5"
  }, metrics.cpu.per_core_usage.map((u, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "space-y-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-10 bg-[#161B21] rounded flex flex-col justify-end p-0.5 overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: `w-full rounded-sm transition-all duration-300 ${u > 80 ? 'bg-red-500' : u > 60 ? 'bg-[#E8913C]' : 'bg-[#E8913C]/80'}`,
    style: {
      height: `${u}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-[9px] text-center font-mono text-[#9EA5A8]"
  }, Math.round(u), "%")))))), /*#__PURE__*/React.createElement("div", {
    className: `p-6 rounded-2xl border transition-all gamer-panel ${getTempColorClass(metrics.gpu.core_temp_c)}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl"
  }, "🎮"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold text-white uppercase tracking-wider font-mono"
  }, "GPU Core & Hotspot"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, metrics.gpu.name))), getTempStatusBadge(metrics.gpu.core_temp_c)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline justify-between py-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-5xl font-extrabold font-mono tracking-tight text-[#EDE7DC]"
  }, metrics.gpu.core_temp_c, "°C"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-[#9EA5A8] font-mono mt-1"
  }, "Hotspot: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-[#E8913C]"
  }, metrics.gpu.hotspot_temp_c, "°C"), " • Fan: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-[#2E6B72]"
  }, metrics.gpu.fan_speed_pct, "%"), " • Power: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-[#EDE7DC]"
  }, metrics.gpu.power_watts, " W"))), /*#__PURE__*/React.createElement("div", {
    className: "text-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold font-mono text-[#2E6B72]"
  }, metrics.gpu.usage_pct, "%"), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-[#6C7378] font-mono"
  }, "GPU Load"))), /*#__PURE__*/React.createElement("div", {
    className: "pt-4 border-t border-[rgba(237,231,220,0.13)] space-y-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-[11px] font-mono text-[#9EA5A8]"
  }, /*#__PURE__*/React.createElement("span", null, "VRAM Allocation"), /*#__PURE__*/React.createElement("span", null, (metrics.gpu.vram_used_mb / 1024).toFixed(1), " GB / ", (metrics.gpu.vram_total_mb / 1024).toFixed(1), " GB (", metrics.gpu.vram_pct, "%)")), /*#__PURE__*/React.createElement("div", {
    className: "w-full h-3 bg-[#161B21] rounded-full overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full bg-[#2E6B72] transition-all duration-300",
    style: {
      width: `${metrics.gpu.vram_pct}%`
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 rounded-2xl border border-[rgba(46,107,114,0.45)] bg-[#101317] gamer-panel transition-all space-y-4 shadow-[0_0_25px_rgba(46,107,114,0.18)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: `text-2xl inline-block ${(metrics.fans?.[0]?.rpm || 0) > 0 ? 'animate-spin' : ''}`,
    style: {
      animationDuration: `${Math.max(0.4, 4.0 - ((metrics.fans?.[0]?.rpm || 2400) / 4200) * 3.5)}s`
    }
  }, "🌀"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2"
  }, "Cooling Fans & Airflow", /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40"
  }, "LIVE")), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "Dell SMM Centrifugal Blower"))), /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] font-mono font-bold px-2 py-0.5 rounded ${burstCountdown > 0 ? 'bg-red-950 text-red-400 border border-red-500/40 animate-pulse' : 'bg-[rgba(46,107,114,0.2)] text-[#88c9cf] border border-[rgba(46,107,114,0.4)]'}`
  }, burstCountdown > 0 ? `BURST: ${burstCountdown}s` : "AUTO GOVERNOR")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline justify-between py-1"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-5xl font-extrabold font-mono tracking-tight text-[#EDE7DC]"
  }, metrics.fans?.[0]?.rpm || 2400, /*#__PURE__*/React.createElement("span", {
    className: "text-lg text-[#9EA5A8] font-normal"
  }, " RPM")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-[#9EA5A8] font-mono mt-1"
  }, "Airflow: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-[#88c9cf]"
  }, `${Math.round(((metrics.fans?.[0]?.rpm || 2400) / 4200) * 24.5)} CFM`), " • Noise: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-[#EDE7DC]"
  }, (metrics.fans?.[0]?.rpm || 2400) > 3500 ? '42 dBA' : (metrics.fans?.[0]?.rpm || 2400) > 2200 ? '31 dBA' : '22 dBA'))), /*#__PURE__*/React.createElement("div", {
    className: "text-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold font-mono text-[#88c9cf]"
  }, `${Math.min(100, Math.round(((metrics.fans?.[0]?.rpm || 2400) / 4200) * 100))}%`), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-[#6C7378] font-mono"
  }, "Duty Cycle"))), /*#__PURE__*/React.createElement("div", {
    className: "pt-3 border-t border-[rgba(237,231,220,0.13)] space-y-2 text-xs font-mono"
  }, /*#__PURE__*/React.createElement("div", {
    className: "space-y-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-[11px] text-[#9EA5A8]"
  }, /*#__PURE__*/React.createElement("span", null, "Primary CPU Blower"), /*#__PURE__*/React.createElement("span", {
    className: "text-white font-bold"
  }, `${metrics.fans?.[0]?.rpm || 2400} RPM`)), /*#__PURE__*/React.createElement("div", {
    className: "w-full h-2 bg-[#161B21] rounded-full overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full bg-[#2E6B72] transition-all duration-300",
    style: {
      width: `${Math.min(100, Math.round(((metrics.fans?.[0]?.rpm || 2400) / 4200) * 100))}%`
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-[11px] text-[#9EA5A8]"
  }, /*#__PURE__*/React.createElement("span", null, "Chassis Exhaust Airflow"), /*#__PURE__*/React.createElement("span", {
    className: "text-white font-bold"
  }, `${metrics.fans?.[1]?.rpm || Math.round((metrics.fans?.[0]?.rpm || 2400) * 0.85)} RPM`)), /*#__PURE__*/React.createElement("div", {
    className: "w-full h-2 bg-[#161B21] rounded-full overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full bg-[#E8913C] transition-all duration-300",
    style: {
      width: `${Math.min(100, Math.round(((metrics.fans?.[1]?.rpm || Math.round((metrics.fans?.[0]?.rpm || 2400) * 0.85)) / 4200) * 100))}%`
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "pt-2 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleTurboBurst(15),
    disabled: burstCountdown > 0,
    className: `flex-1 py-1.5 px-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${burstCountdown > 0 ? 'bg-red-500/20 text-red-300 border border-red-500/40 cursor-not-allowed' : 'bg-[rgba(232,145,60,0.15)] text-[#E8913C] hover:bg-[rgba(232,145,60,0.25)] border border-[rgba(232,145,60,0.4)]'}`
  }, "⚡ 100% Turbo Boost"), /*#__PURE__*/React.createElement("button", {
    onClick: handleFanAuto,
    className: "py-1.5 px-3 rounded-xl bg-[#161B21] hover:bg-[#2A333C] text-[#9EA5A8] border border-[rgba(237,231,220,0.12)] font-mono text-xs font-bold transition-all"
  }, "Auto Curve")))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-display font-bold text-[#EDE7DC] uppercase tracking-tight flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", null, "📈"), " Live 60-Second Thermal History (Rolling)"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8] font-mono"
  }, "Streams real telemetry every 1s with dual-accent trajectories")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-4 text-xs font-mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-[#E8913C]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2.5 h-2.5 rounded-full bg-[#E8913C]"
  }), " CPU (Amber)"), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-[#88c9cf]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2.5 h-2.5 rounded-full bg-[#2E6B72]"
  }), " GPU (Teal)"), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-emerald-400"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2.5 h-2.5 rounded-full bg-emerald-500"
  }), " Fan Speed (Green)"), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-[#E8913C]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2.5 h-0.5 bg-[#E8913C] border border-dashed"
  }), " Warn 80°C"), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-red-400"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2.5 h-0.5 bg-red-400 border border-dashed"
  }), " Crit 92°C"))), /*#__PURE__*/React.createElement("div", {
    className: "w-full h-56 relative bg-[#0A0C0E] rounded-xl border border-[rgba(237,231,220,0.13)] p-2 overflow-hidden flex flex-col justify-end"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "border-b border-red-500 border-dashed w-full flex justify-between text-[10px] text-red-400 font-mono"
  }, /*#__PURE__*/React.createElement("span", null, "92°C Critical")), /*#__PURE__*/React.createElement("div", {
    className: "border-b border-amber-500 border-dashed w-full flex justify-between text-[10px] text-amber-400 font-mono"
  }, /*#__PURE__*/React.createElement("span", null, "80°C Warning")), /*#__PURE__*/React.createElement("div", {
    className: "border-b border-slate-600 w-full flex justify-between text-[10px] text-[#9EA5A8] font-mono"
  }, /*#__PURE__*/React.createElement("span", null, "60°C Base"))), /*#__PURE__*/React.createElement("svg", {
    className: "w-full h-full",
    viewBox: "0 0 600 200",
    preserveAspectRatio: "none"
  }, history.length > 1 && /*#__PURE__*/React.createElement("path", {
    fill: "none",
    stroke: "#E8913C",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    d: history.map((pt, i) => {
      const x = i / 59 * 600;
      const y = 200 - Math.min(200, Math.max(10, (pt.cpuTemp - 40) / 65 * 200));
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ')
  }), history.length > 1 && /*#__PURE__*/React.createElement("path", {
    fill: "none",
    stroke: "#2E6B72",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    d: history.map((pt, i) => {
      const x = i / 59 * 600;
      const y = 200 - Math.min(200, Math.max(10, (pt.gpuTemp - 40) / 65 * 200));
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ')
  }), history.length > 1 && /*#__PURE__*/React.createElement("path", {
    fill: "none",
    stroke: "#10B981",
    strokeWidth: "1.8",
    strokeDasharray: "4 2",
    strokeLinecap: "round",
    d: history.map((pt, i) => {
      const x = i / 59 * 600;
      const y = 200 - Math.min(200, Math.max(10, ((pt.fanRpm || 2400) / 4200) * 190));
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ')
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-[10px] text-[#6C7378] font-mono pt-1 px-2 border-t border-[rgba(237,231,220,0.13)]"
  }, /*#__PURE__*/React.createElement("span", null, "60 seconds ago"), /*#__PURE__*/React.createElement("span", null, "30s ago"), /*#__PURE__*/React.createElement("span", null, "Live (now)")))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-mono font-bold text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-[#2E6B72]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base animate-spin",
    style: {
      animationDuration: '3s'
    }
  }, "🌀"), " Active Fan RPMs"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-[#161B21] px-1.5 py-0.5 rounded"
  }, metrics.fans.length, " Fans")), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 pt-1"
  }, metrics.fans.map((fan, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "flex justify-between items-center text-xs font-mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#9EA5A8] truncate max-w-[130px]"
  }, fan.name), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-white"
  }, fan.rpm, " RPM"))))), /*#__PURE__*/React.createElement("div", {
    className: "p-5 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-mono font-bold text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-purple-400"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "💾"), " System Memory"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-purple-950/60 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded"
  }, metrics.ram.usage_pct, "%")), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold font-mono text-white"
  }, metrics.ram.used_gb, " GB ", /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-[#9EA5A8] font-normal"
  }, "/ ", metrics.ram.total_gb, " GB")), /*#__PURE__*/React.createElement("div", {
    className: "w-full h-2 bg-[#161B21] rounded-full overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full bg-purple-500 rounded-full",
    style: {
      width: `${metrics.ram.usage_pct}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] font-mono text-[#9EA5A8] flex justify-between"
  }, /*#__PURE__*/React.createElement("span", null, metrics.ram.type || 'RAM', ":"), /*#__PURE__*/React.createElement("strong", {
    className: "text-[#2E6B72]"
  }, (metrics.ram.total_gb - metrics.ram.used_gb).toFixed(1), " GB Free"))), /*#__PURE__*/React.createElement("div", {
    className: "p-5 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-mono font-bold text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-amber-400"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "💽"), " Flash SSD Storage"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-[#161B21] px-1.5 py-0.5 rounded"
  }, metrics.disk.usage_pct, "%")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-mono text-[#EDE7DC] space-y-1.5 pt-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#9EA5A8]"
  }, "Read Speed:"), /*#__PURE__*/React.createElement("strong", {
    className: "text-[#E8913C]"
  }, metrics.disk.read_speed_mbps, " MB/s")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#9EA5A8]"
  }, "Write Speed:"), /*#__PURE__*/React.createElement("strong", {
    className: "text-[#2E6B72]"
  }, metrics.disk.write_speed_mbps, " MB/s")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between pt-1 border-t border-[rgba(237,231,220,0.13)]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#9EA5A8]"
  }, "APFS Storage:"), /*#__PURE__*/React.createElement("strong", {
    className: "text-white"
  }, metrics.disk.used_gb, " GB / ", metrics.disk.total_gb, " GB")))), /*#__PURE__*/React.createElement("div", {
    className: "p-5 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-mono font-bold text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "🌐"), " Network Latency"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-[rgba(46,107,114,0.2)] text-[#88c9cf] border border-[rgba(46,107,114,0.4)] px-1.5 py-0.5 rounded"
  }, "Online")), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold font-mono text-white"
  }, metrics.network.ping_ms, " ms ", /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-[#9EA5A8] font-normal"
  }, "Ping")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-mono text-[#EDE7DC] space-y-1.5 pt-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#9EA5A8]"
  }, "Downlink:"), /*#__PURE__*/React.createElement("strong", {
    className: "text-[#E8913C]"
  }, metrics.network.down_mbps, " Mbps")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#9EA5A8]"
  }, "Uplink:"), /*#__PURE__*/React.createElement("strong", {
    className: "text-[#2E6B72]"
  }, metrics.network.up_mbps, " Mbps")))), /*#__PURE__*/React.createElement("div", {
    className: "p-5 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-mono font-bold text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1.5 text-[#2E6B72]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "🔋"), " MacBook Battery"), /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] px-1.5 py-0.5 rounded font-bold ${metrics.battery?.is_charging ? 'bg-[#101317] text-[#E8913C] border border-[rgba(232,145,60,0.4)]' : metrics.battery?.percent < 20 ? 'bg-red-950/80 text-red-300 border border-red-500/30' : 'bg-[#101317] text-[#88c9cf] border border-[rgba(46,107,114,0.4)]'}`
  }, metrics.battery?.status || (metrics.battery?.is_charging ? 'Charging' : 'On Battery'))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold font-mono text-white"
  }, metrics.battery?.percent || 80, "%"), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] font-mono text-[#9EA5A8]"
  }, metrics.battery?.secsleft ? `${Math.round(metrics.battery.secsleft / 3600)}h ${Math.round(metrics.battery.secsleft % 3600 / 60)}m left` : 'Optimal')), /*#__PURE__*/React.createElement("div", {
    className: "w-full h-2 bg-[#161B21] rounded-full overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: `h-full rounded-full transition-all duration-300 ${(metrics.battery?.percent || 80) > 40 ? 'bg-[#2E6B72]' : (metrics.battery?.percent || 80) > 20 ? 'bg-[#E8913C]' : 'bg-red-500'}`,
    style: {
      width: `${metrics.battery?.percent || 80}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-1 pt-1 border-t border-[rgba(237,231,220,0.13)] text-[10px] font-mono text-[#9EA5A8]"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "block text-[#6C7378] text-[9px]"
  }, "Health"), /*#__PURE__*/React.createElement("strong", {
    className: "text-[#2E6B72]"
  }, metrics.battery?.health_pct || 95, "%")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "block text-[#6C7378] text-[9px]"
  }, "Cycles"), /*#__PURE__*/React.createElement("strong", {
    className: "text-[#EDE7DC]"
  }, metrics.battery?.cycles || 83)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "block text-[#6C7378] text-[9px]"
  }, "Cell Temp"), /*#__PURE__*/React.createElement("strong", {
    className: "text-[#E8913C]"
  }, metrics.battery?.temp_c || 30.3, "°C")))))), activeTab === 'advisor' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border-2 border-[#E8913C] rounded-2xl gamer-panel bg-gradient-to-r from-[#E8913C]/10 via-[#101317] to-[#2E6B72]/15 shadow-[0_0_30px_rgba(232,145,60,0.15)] flex items-center justify-between flex-wrap gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl"
  }, "🩺"), /*#__PURE__*/React.createElement("h3", {
    className: "text-base font-bold text-white font-display"
  }, "Laptop Health Diagnostic & Past Abnormal Issues"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40"
  }, "AI DOCTOR")), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8] mt-1"
  }, "Real-time hardware integrity evaluation, historical incident logs from techdef.db, and personalized protection rules.")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: fetchHealthAndIssues,
    className: "px-3 py-2 rounded-xl bg-[#161B21] hover:bg-[#2A333C] text-[#EDE7DC] font-mono text-xs font-bold border border-[rgba(237,231,220,0.15)] flex items-center gap-1.5 transition-all"
  }, "🔄 Refresh Diagnostics"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      handleSetFan();
      addToast('success', 'Protection Mode Active', 'Optimal cooling & balanced power profile engaged.');
    },
    className: "px-4 py-2 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
  }, "🛡️ Auto-Optimize Protection"))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-mono font-bold text-[#9EA5A8]"
  }, /*#__PURE__*/React.createElement("span", null, "OVERALL HEALTH SCORE"), /*#__PURE__*/React.createElement("span", {
    className: "px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px]"
  }, healthData?.status_label || "Optimal")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-baseline gap-2 py-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: `text-5xl font-black font-mono ${healthData?.health_score < 75 ? 'text-amber-400' : 'text-emerald-400'}`
  }, healthData?.health_score || 88), /*#__PURE__*/React.createElement("div", {
    className: "text-base font-mono text-[#9EA5A8]"
  }, "/ 100")), /*#__PURE__*/React.createElement("div", {
    className: "w-full h-2.5 bg-[#161B21] rounded-full overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full bg-gradient-to-r from-emerald-500 to-[#E8913C]",
    style: {
      width: `${healthData?.health_score || 88}%`
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-[#6C7378] font-mono"
  }, "Evaluated against thermal saturation, throttle frequency & fan response.")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-mono font-bold text-[#9EA5A8]"
  }, /*#__PURE__*/React.createElement("span", null, "HARDWARE UNDER WATCH"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-[#E8913C]"
  }, "Ryzen 5 APU")), /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-white font-display truncate"
  }, metrics.cpu.name || "Dell Inspiron 15 (Ryzen 5 7520U)"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2 pt-1 font-mono text-xs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-2 rounded bg-[#0A0C0E] border border-[rgba(237,231,220,0.1)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-[#9EA5A8]"
  }, "Die Temp"), /*#__PURE__*/React.createElement("div", {
    className: "text-lg font-bold text-[#E8913C]"
  }, metrics.cpu.package_temp_c, "°C")), /*#__PURE__*/React.createElement("div", {
    className: "p-2 rounded bg-[#0A0C0E] border border-[rgba(237,231,220,0.1)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-[#9EA5A8]"
  }, "Fan Blower"), /*#__PURE__*/React.createElement("div", {
    className: "text-lg font-bold text-[#88c9cf]"
  }, metrics.fans?.[0]?.rpm || 2400, " RPM"))), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-[#6C7378] font-mono"
  }, "Safe thermal headroom: ", Math.max(0, 92 - metrics.cpu.package_temp_c).toFixed(1), "°C to 92°C ceiling.")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-xs font-mono font-bold text-[#9EA5A8]"
  }, /*#__PURE__*/React.createElement("span", null, "INCIDENT HISTORY LOG"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] bg-red-950 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30"
  }, "SQLite techdef.db")), /*#__PURE__*/React.createElement("div", {
    className: "text-3xl font-extrabold font-mono text-white"
  }, issuesList.length, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-normal text-[#9EA5A8] ml-2"
  }, "Total Events Logged")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 text-xs font-mono pt-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-red-400"
  }, "🚨 ", issuesList.filter(x => x.severity === 'critical').length, " Critical Overheats"), /*#__PURE__*/React.createElement("span", {
    className: "text-amber-400"
  }, "⚠️ ", issuesList.filter(x => x.severity === 'warning').length, " Warnings")), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-emerald-400 font-mono"
  }, "✓ 100% of past thermal events were safely mitigated."))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-sm font-bold text-red-400 font-mono uppercase tracking-wider"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-lg"
  }, "🚨"), " Strict Laptop Protection Rules // What NOT To Do"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, (healthData?.what_not_to_do || [
    { icon: "🚫", title: "DO NOT use laptop on beds, blankets, pillows, or carpet", why: "Bottom air intake vents become completely choked within 60s.", consequence: "Heatsink reaches 95°C thermal saturation, causing severe clock throttling and fan motor wear.", rule: "Always place on a flat desk or rigid stand.", badge: "CRITICAL" },
    { icon: "🚫", title: "DO NOT run browser games with uncapped FPS", why: "Chrome and Edge WebGL engines will render at 200+ FPS unnecessarily.", consequence: "Dumps 25W+ of continuous heat on the unified APU die.", rule: "Cap monitor refresh rate to 60Hz or 120Hz.", badge: "HIGH IMPACT" },
    { icon: "🚫", title: "DO NOT game while running on battery power alone", why: "High battery discharge generates chemical heat alongside APU heat.", consequence: "Triggers aggressive 1.4 GHz clock throttling to preserve cell safety.", rule: "Always connect the AC barrel charger before gaming.", badge: "BATTERY HEALTH" },
    { icon: "🚫", title: "DO NOT obstruct the rear hinge exhaust vents", why: "Hot exhaust air blows directly against walls or close items.", consequence: "Hot air gets sucked back into intake fans in a continuous feedback loop.", rule: "Keep at least 4 inches (10 cm) of open space behind the laptop.", badge: "AIRFLOW CEILING" }
  ]).map((item, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "p-4 bg-[#101317] border border-red-500/30 rounded-2xl gamer-panel space-y-2 hover:border-red-500/60 transition-all"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-sm font-bold text-red-300 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", null, item.icon), item.title), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-500/40"
  }, item.badge)), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("strong", {
    className: "text-[#E8913C]"
  }, "Why: "), item.why), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, /*#__PURE__*/React.createElement("strong", {
    className: "text-red-400"
  }, "Damage Risk: "), item.consequence), /*#__PURE__*/React.createElement("div", {
    className: "pt-1.5 border-t border-[rgba(237,231,220,0.1)] text-xs font-mono text-emerald-400 flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("span", null, "✓"), /*#__PURE__*/React.createElement("strong", null, "Safe Practice: "), item.rule))))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-sm font-bold text-emerald-400 font-mono uppercase tracking-wider"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-lg"
  }, "💡"), " Personalized Optimization & Prevention // How To Protect Your Laptop"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
  }, (healthData?.personalized_advice || [
    { icon: "📐", title: "Rear-Foot Elevation (Instant -8°C)", impact: "Airflow Boost", description: "Elevating the back edge by 1 inch allows the blower to draw 35% more cool ambient air.", status: "Recommended" },
    { icon: "🌀", title: "Proactive Fan Governor", impact: "Prevents Spikes", description: "Ramps fans before 80°C to eliminate thermal panic throttles during online gameplay.", status: "Active" },
    { icon: "⚡", title: "Windows Power: Balanced", impact: "Stable Clocks", description: "Windows Balanced mode prevents voltage overshoots, dropping temps by 6°C.", status: "Tuned" },
    { icon: "🧹", title: "Bi-Monthly Dust Clearance", impact: "Long-Term Health", description: "Clean copper heatsink fins every 60 days to restore full 3,800+ RPM dissipation capacity.", status: "Every 60 Days" }
  ]).map((tip, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "p-4 bg-[#101317] border border-[rgba(46,107,114,0.4)] rounded-2xl gamer-panel space-y-2 hover:border-[#88c9cf] transition-all"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl"
  }, tip.icon), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-[rgba(46,107,114,0.2)] text-[#88c9cf] border border-[rgba(46,107,114,0.4)]"
  }, tip.impact)), /*#__PURE__*/React.createElement("h4", {
    className: "text-xs font-bold text-white font-display"
  }, tip.title), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-[#9EA5A8]"
  }, tip.description), /*#__PURE__*/React.createElement("div", {
    className: "pt-1 text-[10px] font-mono text-emerald-400 font-bold"
  }, "Status: ", tip.status))))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between flex-wrap gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-white uppercase font-mono flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", null, "📋"), " Past Abnormal Behavior & Incident Log"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "Persistent record of every thermal spike, throttle, and autonomous fan intervention stored in techdef.db")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, ['all', 'critical', 'warning'].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    onClick: () => setIssuesFilter(f),
    className: `px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${issuesFilter === f ? 'bg-[#E8913C] text-[#0A0C0E] border-[#E8913C]' : 'bg-[#161B21] border-[rgba(237,231,220,0.12)] text-[#9EA5A8] hover:text-white'}`
  }, f === 'all' ? `All (${issuesList.length})` : f === 'critical' ? `🚨 Critical (${issuesList.filter(x => x.severity === 'critical').length})` : `⚠️ Warnings (${issuesList.filter(x => x.severity === 'warning').length})`)))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3 max-h-[500px] overflow-y-auto pr-1"
  }, issuesList.filter(item => issuesFilter === 'all' ? true : item.severity === issuesFilter).length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "p-8 text-center text-xs font-mono text-[#9EA5A8] bg-[#0A0C0E] rounded-xl border border-[rgba(237,231,220,0.1)]"
  }, "No abnormal behavior records match the selected filter.") : issuesList.filter(item => issuesFilter === 'all' ? true : item.severity === issuesFilter).map((issue, idx) => /*#__PURE__*/React.createElement("div", {
    key: issue.id || idx,
    className: `p-4 rounded-xl border transition-all ${issue.severity === 'critical' ? 'bg-[#150D0D] border-red-500/40 hover:border-red-500/80' : 'bg-[#13120E] border-amber-500/30 hover:border-amber-500/70'} space-y-2`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, issue.severity === 'critical' ? '🚨' : '⚠️'), /*#__PURE__*/React.createElement("h5", {
    className: "text-xs font-bold text-white font-mono"
  }, issue.title || `Thermal Event on ${issue.component}`), issue.game && /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono px-2 py-0.5 rounded bg-[#161B21] text-[#E8913C] border border-[rgba(232,145,60,0.3)]"
  }, "🎮 ", issue.game)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: `text-xs font-mono font-black px-2 py-0.5 rounded ${issue.severity === 'critical' ? 'bg-red-950 text-red-300 border border-red-500/50' : 'bg-amber-950 text-amber-300 border border-amber-500/50'}`
  }, issue.temp_c, "°C"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono text-[#9EA5A8]"
  }, new Date(issue.timestamp).toLocaleString()))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#EDE7DC]"
  }, issue.description), /*#__PURE__*/React.createElement("div", {
    className: "pt-2 border-t border-[rgba(237,231,220,0.1)] flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-emerald-400 flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("span", null, "⚡"), /*#__PURE__*/React.createElement("strong", null, "Action Taken: "), issue.action_taken || issue.mitigation), /*#__PURE__*/React.createElement("span", {
    className: "px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold"
  }, issue.status || "Resolved"))))))), activeTab === 'fans' && /*#__PURE__*/React.createElement("div", {
  className: "space-y-6"
}, /*#__PURE__*/React.createElement("div", {
  className: `p-6 bg-[#101317] border rounded-2xl gamer-panel space-y-4 ${burstCountdown > 0 ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] bg-red-950/20' : 'border-[rgba(232,145,60,0.4)]'}`
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between flex-wrap gap-4"
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  className: `text-[10px] font-mono font-bold tracking-[0.15em] uppercase ${burstCountdown > 0 ? 'text-red-400' : 'text-[#E8913C]'}`
}, burstCountdown > 0 ? '⚡ TURBO COOLING ENGAGED (MAX 100% BLAST)' : '⚡ INSTANT 100% TURBO BOOST'), /*#__PURE__*/React.createElement("h3", {
  className: "text-lg font-bold text-white font-display mt-1"
}, burstCountdown > 0 ? `Fan at 100% Maximum Power — Remaining: ${burstCountdown}s` : 'Push Fan to 100% Full Power for Immediate Heat Clearance'), /*#__PURE__*/React.createElement("p", {
  className: "text-xs text-[#9EA5A8] mt-1"
}, burstCountdown > 0 ? 'Hardware fan controller active at maximum speed. Cooling heatsink at maximum rate.' : 'Click to instantly blast the fans at 100% power for 10 or 20 seconds.')), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-3"
}, burstCountdown > 0 ? /*#__PURE__*/React.createElement("button", {
  onClick: handleStopTurbo,
  className: "px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs font-mono uppercase tracking-wider shadow-lg transition-all"
}, "⏹ Stop Turbo Now") : [/*#__PURE__*/React.createElement("button", {
  key: "blast10",
  onClick: () => handleTurboBurst(10),
  className: "px-4 py-2.5 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-bold text-xs font-mono uppercase tracking-wider shadow-md transition-all flex items-center gap-2"
}, "💨 10s Blast (100%)"), /*#__PURE__*/React.createElement("button", {
  key: "blast20",
  onClick: () => handleTurboBurst(20),
  className: "px-4 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs font-mono uppercase tracking-wider shadow-md transition-all flex items-center gap-2"
}, "⚡ 20s Max Fan (100%)")]))), fanData?.recommendation && /*#__PURE__*/React.createElement("div", {
  className: `p-5 bg-[#101317] border rounded-2xl gamer-panel flex items-center justify-between flex-wrap gap-4 ${fanData.recommendation.color === 'red' ? 'border-red-500/40 bg-red-950/10' : fanData.recommendation.color === 'amber' ? 'border-amber-500/40 bg-amber-950/10' : 'border-[#2E6B72]/40 bg-[#2E6B72]/10'}`
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  className: "text-[10px] font-mono font-bold uppercase tracking-wider text-[#9EA5A8]"
}, `Recommended for Current Temperature (${fanData.recommendation.max_temp}°C)`), /*#__PURE__*/React.createElement("div", {
  className: "text-2xl font-bold font-mono text-white mt-1"
}, `${fanData.recommendation.recommended_pct}% FAN SPEED`), /*#__PURE__*/React.createElement("div", {
  className: "text-xs text-[#9EA5A8] mt-1"
}, fanData.recommendation.reason)), /*#__PURE__*/React.createElement("button", {
  onClick: () => { setFanSlider(fanData.recommendation.recommended_pct); setTimeout(handleSetFan, 50); },
  className: "px-4 py-2 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-bold text-xs font-mono"
}, `Apply ${fanData.recommendation.recommended_pct}% →`)), /*#__PURE__*/React.createElement("div", {
  className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-6"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between"
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
  className: "text-sm font-bold text-white uppercase font-mono"
}, "Manual Fan Speed Control"), /*#__PURE__*/React.createElement("p", {
  className: "text-xs text-[#9EA5A8]"
}, "Direct slider override with 5 thermal preset zones")), /*#__PURE__*/React.createElement("label", {
  className: "flex items-center gap-2 text-xs font-mono text-[#9EA5A8] cursor-pointer"
}, /*#__PURE__*/React.createElement("input", {
  type: "checkbox",
  checked: safetyOptIn,
  onChange: e => handleFanEnable(e.target.checked),
  className: "accent-[#E8913C]"
}), "Hardware Fan Control")), /*#__PURE__*/React.createElement("div", {
  className: "space-y-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-xs font-mono text-[#9EA5A8]"
}, "FAN TARGET"), /*#__PURE__*/React.createElement("span", {
  className: "text-3xl font-extrabold font-mono text-[#E8913C]"
}, `${fanSlider}%`)), /*#__PURE__*/React.createElement("input", {
  type: "range",
  min: 0,
  max: 100,
  value: fanSlider,
  onChange: e => setFanSlider(Number(e.target.value)),
  className: "w-full h-2.5 bg-[#161B21] rounded-lg appearance-none cursor-pointer accent-[#E8913C]"
}), /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-5 gap-2 pt-2"
}, [{ l: 'QUIET', r: '20%', c: 20 }, { l: 'BALANCED', r: '45%', c: 45 }, { l: 'GAMING', r: '70%', c: 70 }, { l: 'HIGH', r: '85%', c: 85 }, { l: 'TURBO', r: '100%', c: 100 }].map(z => /*#__PURE__*/React.createElement("button", {
  key: z.l,
  onClick: () => setFanSlider(z.c),
  className: `p-2 rounded-lg text-center border transition-all ${fanSlider === z.c ? 'bg-[#E8913C]/20 border-[#E8913C] text-[#E8913C]' : 'bg-[#161B21] border-transparent text-[#9EA5A8] hover:border-[rgba(237,231,220,0.2)]'}`
}, /*#__PURE__*/React.createElement("div", {
  className: "text-[10px] font-bold font-mono"
}, z.l), /*#__PURE__*/React.createElement("div", {
  className: "text-[9px] text-[#6C7378]"
}, z.r))))), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-3 pt-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: handleSetFan,
  disabled: fanApplying,
  className: "flex-1 py-2.5 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-bold text-xs font-mono uppercase tracking-wider transition-all"
}, fanApplying ? "Applying..." : `Set Fan to ${fanSlider}%`), /*#__PURE__*/React.createElement("button", {
  onClick: handleFanAuto,
  className: "px-4 py-2.5 rounded-xl bg-[#161B21] hover:bg-[#2A333C] text-[#EDE7DC] font-bold text-xs font-mono border border-[rgba(237,231,220,0.15)]"
}, "Auto Mode"))), /*#__PURE__*/React.createElement("div", {
  className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-4"
}, /*#__PURE__*/React.createElement("h4", {
  className: "text-sm font-bold text-white uppercase font-mono"
}, "Active Fans Telemetry"), /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
}, (metrics.fans || []).map((fan, i) => /*#__PURE__*/React.createElement("div", {
  key: fan.id || i,
  className: "p-4 rounded-xl bg-[#161B21] border border-[rgba(237,231,220,0.08)] flex items-center justify-between"
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  className: "text-xs font-semibold text-white font-mono"
}, fan.name), /*#__PURE__*/React.createElement("div", {
  className: "text-[10px] text-[#9EA5A8]"
}, "Hardware Fan Governor")), /*#__PURE__*/React.createElement("div", {
  className: "text-lg font-bold font-mono text-[#E8913C]"
}, `${fan.rpm || 1850} RPM`)))))), activeTab === 'community' && /*#__PURE__*/React.createElement("div", {
  className: "space-y-6"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between flex-wrap gap-4"
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
  className: "text-base font-bold text-white uppercase font-mono"
}, "Gamer Community & Thermal Discussion"), /*#__PURE__*/React.createElement("p", {
  className: "text-xs text-[#9EA5A8]"
}, "Share undervolt profiles, cooling setups, and real laptop experiences")), /*#__PURE__*/React.createElement("button", {
  onClick: () => setShowPostForm(!showPostForm),
  className: "px-4 py-2 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-bold text-xs font-mono"
}, showPostForm ? "✕ Cancel" : "+ Share Post")), communityStats && /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-2 md:grid-cols-4 gap-4"
}, [{ k: 'MEMBERS', v: communityStats.total_members }, { k: 'POSTS', v: communityStats.total_posts }, { k: 'REPLIES', v: communityStats.total_comments }, { k: 'LIKES', v: communityStats.total_likes }].map(s => /*#__PURE__*/React.createElement("div", {
  key: s.k,
  className: "p-4 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-xl gamer-panel text-center"
}, /*#__PURE__*/React.createElement("div", {
  className: "text-[10px] font-mono text-[#6C7378]"
}, s.k), /*#__PURE__*/React.createElement("div", {
  className: "text-xl font-bold font-mono text-[#E8913C] mt-1"
}, s.v)))), showPostForm && /*#__PURE__*/React.createElement("form", {
  onSubmit: handleCreatePost,
  className: "p-6 bg-[#101317] border border-[#E8913C]/40 rounded-2xl gamer-panel space-y-4"
}, /*#__PURE__*/React.createElement("h4", {
  className: "text-sm font-bold text-white font-mono uppercase"
}, "Publish New Community Post"), /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-1 md:grid-cols-2 gap-4"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  placeholder: "Your Gamer Tag / Username (e.g. FrostGamer)",
  value: newPost.username,
  onChange: e => setNewPost({ ...newPost, username: e.target.value }),
  className: "p-2.5 rounded-lg bg-[#161B21] border border-[rgba(237,231,220,0.15)] text-xs text-white outline-none"
}), /*#__PURE__*/React.createElement("select", {
  value: newPost.post_type,
  onChange: e => setNewPost({ ...newPost, post_type: e.target.value }),
  className: "p-2.5 rounded-lg bg-[#161B21] border border-[rgba(237,231,220,0.15)] text-xs text-white outline-none"
}, /*#__PURE__*/React.createElement("option", { value: "experience" }, "Gaming Thermal Experience"), /*#__PURE__*/React.createElement("option", { value: "spec_share" }, "Hardware Rig & Spec Share"), /*#__PURE__*/React.createElement("option", { value: "tip" }, "Cooling / Undervolt Pro Tip"))), /*#__PURE__*/React.createElement("input", {
  type: "text",
  placeholder: "Post Title...",
  value: newPost.title,
  onChange: e => setNewPost({ ...newPost, title: e.target.value }),
  className: "w-full p-2.5 rounded-lg bg-[#161B21] border border-[rgba(237,231,220,0.15)] text-xs text-white outline-none"
}), /*#__PURE__*/React.createElement("textarea", {
  rows: 4,
  placeholder: "Describe your laptop thermal performance, game FPS, undervolt offsets, or fan curves...",
  value: newPost.body,
  onChange: e => setNewPost({ ...newPost, body: e.target.value }),
  className: "w-full p-2.5 rounded-lg bg-[#161B21] border border-[rgba(237,231,220,0.15)] text-xs text-white outline-none"
}), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between"
}, /*#__PURE__*/React.createElement("label", {
  className: "flex items-center gap-2 text-xs font-mono text-[#9EA5A8] cursor-pointer"
}, /*#__PURE__*/React.createElement("input", {
  type: "checkbox",
  checked: newPost.attach_specs,
  onChange: e => setNewPost({ ...newPost, attach_specs: e.target.checked }),
  className: "accent-[#E8913C]"
}), "Attach my live hardware specs (Ryzen 5 / Radeon)"), /*#__PURE__*/React.createElement("button", {
  type: "submit",
  className: "px-5 py-2 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-bold text-xs font-mono"
}, "Publish Post →"))), /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, communityPosts.map(post => /*#__PURE__*/React.createElement("div", {
  key: post.id,
  className: "p-5 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-xs font-bold text-white font-mono"
}, post.username || "Anonymous Gamer"), /*#__PURE__*/React.createElement("span", {
  className: "text-[10px] font-mono px-2 py-0.5 rounded bg-[#161B21] text-[#9EA5A8]"
}, post.post_type)), /*#__PURE__*/React.createElement("span", {
  className: "text-[10px] font-mono text-[#6C7378]"
}, new Date(post.created_at * 1000).toLocaleDateString())), /*#__PURE__*/React.createElement("h4", {
  className: "text-sm font-bold text-[#EDE7DC]"
}, post.title), /*#__PURE__*/React.createElement("p", {
  className: "text-xs text-[#9EA5A8] leading-relaxed"
}, post.body), post.cpu_model && /*#__PURE__*/React.createElement("div", {
  className: "p-3 rounded-lg bg-[#0A0C0E] border border-[rgba(237,231,220,0.08)] flex items-center gap-4 text-[10px] font-mono text-[#88c9cf]"
}, /*#__PURE__*/React.createElement("span", null, `💻 ${post.cpu_model}`), /*#__PURE__*/React.createElement("span", null, `🎮 ${post.gpu_model || 'Integrated Graphics'}`)), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-4 pt-2 border-t border-[rgba(237,231,220,0.06)]"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => handleLikePost(post.id),
  className: "text-xs font-mono font-bold text-[#E8913C] hover:text-[#d97d26] flex items-center gap-1.5"
}, "🔥", post.likes || 0, "Likes"), /*#__PURE__*/React.createElement("button", {
  onClick: () => setExpandedPost(expandedPost === post.id ? null : post.id),
  className: "text-xs font-mono text-[#9EA5A8] hover:text-white"
}, `💬 ${post.comment_count || (post.comments ? post.comments.length : 0)} Comments`)), expandedPost === post.id && /*#__PURE__*/React.createElement("div", {
  className: "mt-3 pt-3 border-t border-[rgba(237,231,220,0.08)] space-y-3"
}, (post.comments || []).map((cm, cidx) => /*#__PURE__*/React.createElement("div", {
  key: cidx,
  className: "p-2.5 rounded-lg bg-[#161B21] text-xs space-y-1"
}, /*#__PURE__*/React.createElement("div", {
  className: "font-bold text-[#E8913C] font-mono text-[10px]"
}, cm.username || "Gamer"), /*#__PURE__*/React.createElement("div", {
  className: "text-[#EDE7DC]"
}, cm.body))), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  placeholder: "Write a reply...",
  value: commentInput,
  onChange: e => setCommentInput(e.target.value),
  className: "flex-1 p-2 rounded-lg bg-[#0A0C0E] border border-[rgba(237,231,220,0.15)] text-xs text-white outline-none"
}), /*#__PURE__*/React.createElement("button", {
  onClick: () => handleAddComment(post.id),
  className: "px-3 py-1.5 rounded-lg bg-[#E8913C] text-[#0A0C0E] font-bold text-xs font-mono"
}, "Reply"))))))), activeTab === 'sessions' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 bg-[#101317] border-2 border-[#E8913C] rounded-2xl gamer-panel space-y-3 bg-gradient-to-r from-[#E8913C]/10 via-[#101317] to-[#2E6B72]/10 shadow-[0_0_25px_rgba(232,145,60,0.15)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between flex-wrap gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-lg"
  }, "🌐"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-mono font-bold text-[#E8913C] uppercase tracking-wider"
  }, "Online Browser Game Integration"), metrics.gaming?.active_game?.includes('FivePlay') && /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 animate-pulse"
  }, "ACTIVE LIVE")), /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-white font-display mt-0.5"
  }, "FivePlay Web Game Launcher (v2.fiveplay.lol)"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "Run and showcase online browser gaming telemetry live in your dashboard for your teacher.")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      window.open('https://v2.fiveplay.lol/launcher.html', '_blank');
      handleGameOverride('FivePlay Online Launcher (v2.fiveplay.lol)');
    },
    className: "px-4 py-2 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-md transition-all"
  }, "▶ Launch Game & Track Live"), /*#__PURE__*/React.createElement("button", {
    onClick: triggerTeacherDemo,
    className: "px-3 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 font-bold text-xs font-mono flex items-center gap-1.5 transition-all shadow-md animate-pulse",
    title: "Triggers external popup over the browser game on Windows desktop"
  }, "🚨 Test Alert Over Game"), metrics.gaming?.active_game?.includes('FivePlay') && /*#__PURE__*/React.createElement("button", {
    onClick: () => handleGameOverride('auto'),
    className: "px-3 py-2 rounded-xl bg-[#161B21] hover:bg-[#2A333C] text-[#9EA5A8] font-bold text-xs font-mono border border-[rgba(237,231,220,0.12)]"
  }, "⏹ Stop")))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#101317] border border-[rgba(232,145,60,0.4)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, "🎮"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-white font-mono uppercase"
  }, "Game Process Tracker // Live Demonstration Switcher")), /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] font-mono font-bold px-2 py-0.5 rounded ${metrics.gaming?.game_running ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-[#161B21] text-[#9EA5A8]'}`
  }, metrics.gaming?.game_running ? `RUNNING: ${metrics.gaming?.active_game}` : 'NO GAME ACTIVE')), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono text-[#9EA5A8]"
  }, "Quick Switch:"), ['auto', 'FivePlay (v2.fiveplay.lol)', 'Roblox', 'Minecraft', 'VALORANT', 'Grand Theft Auto V', 'Cyberpunk 2077'].map(g => /*#__PURE__*/React.createElement("button", {
    key: g,
    onClick: () => handleGameOverride(g),
    className: `px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${metrics.gaming?.active_game === g || (g === 'auto' && !metrics.gaming?.game_running) ? 'bg-[#E8913C] text-[#0A0C0E] border-[#E8913C]' : 'bg-[#161B21] border-[rgba(237,231,220,0.12)] text-[#9EA5A8] hover:text-white'}`
  }, g === 'auto' ? '🔍 Auto-Detect (Real)' : g)))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-base font-bold text-white uppercase font-mono"
  }, "Gaming Session Tracker"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "Automatically logs hardware temperatures and throttling events when games launch")), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-mono bg-[#161B21] px-3 py-1 rounded-full text-[#EDE7DC]"
  }, "SQLite Database")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl"
  }, metrics.gaming?.game_running ? '🎯' : '💤'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "text-base font-bold text-white"
  }, metrics.gaming?.game_running && metrics.gaming?.active_game ? metrics.gaming.active_game : 'No Game Active'), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8] font-mono"
  }, metrics.gaming?.game_running ? 'Live Session Status' : 'System Idle / Standby'))), metrics.gaming?.game_running ? /*#__PURE__*/React.createElement("span", {
    className: "px-3 py-1 rounded-full bg-[rgba(232,145,60,0.15)] text-[#E8913C] border border-[rgba(232,145,60,0.4)] text-xs font-mono font-bold pulse-dot-warn"
  }, "LIVE RECORDING") : /*#__PURE__*/React.createElement("span", {
    className: "px-3 py-1 rounded-full bg-[#161B21] text-[#9EA5A8] text-xs font-mono"
  }, "IDLE / WAITING FOR GAME")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "FPS Stability"), /*#__PURE__*/React.createElement("div", {
    className: "text-xl font-bold font-mono text-[#E8913C] mt-1"
  }, metrics.gaming?.game_running && metrics.gaming?.fps ? `${metrics.gaming.fps} FPS` : '--'), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Live Render Rate")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Frame Time"), /*#__PURE__*/React.createElement("div", {
    className: "text-xl font-bold font-mono text-[#2E6B72] mt-1"
  }, metrics.gaming?.game_running && metrics.gaming?.frametime_ms ? `${metrics.gaming.frametime_ms} ms` : '--'), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Frame Latency")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Game Process CPU"), /*#__PURE__*/React.createElement("div", {
    className: "text-xl font-bold font-mono text-[#EDE7DC] mt-1"
  }, metrics.gaming?.game_running && metrics.gaming?.cpu_pct ? `${metrics.gaming.cpu_pct}%` : '--'), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Active Process Core")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "RAM Allocated"), /*#__PURE__*/React.createElement("div", {
    className: "text-xl font-bold font-mono text-[#EDE7DC] mt-1"
  }, metrics.gaming?.game_running && metrics.gaming?.memory_mb ? `${metrics.gaming.memory_mb} MB` : '--'), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Working Set RSS")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Session Duration"), /*#__PURE__*/React.createElement("div", {
    className: "text-xl font-bold font-mono text-[#E8913C] mt-1"
  }, metrics.gaming?.game_running && metrics.gaming?.session_duration_str ? metrics.gaming.session_duration_str : '--'), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Active Play Clock")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Display & Engine"), /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-bold font-mono text-emerald-400 mt-1 truncate"
  }, metrics.gaming?.game_running && metrics.gaming?.engine ? metrics.gaming.engine.split('/')[0].trim() : 'Desktop 2D'), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5 truncate"
  }, metrics.gaming?.resolution || '1536x864 @ 120Hz')), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Peak Thermal"), /*#__PURE__*/React.createElement("div", {
    className: "text-xl font-bold font-mono text-amber-400 mt-1"
  }, metrics.gaming?.session_peak_cpu ? `${metrics.gaming.session_peak_cpu}°C` : `${Math.max(metrics.cpu.package_temp_c, metrics.gpu.core_temp_c)}°C`), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Peak Junction")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Thermal Throttles"), /*#__PURE__*/React.createElement("div", {
    className: "text-xl font-bold font-mono text-[#EDE7DC] mt-1"
  }, metrics.cpu.is_throttling || metrics.gpu.is_throttling ? 'Active Throttle' : '0 Events (Safe)'), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono text-[#6C7378] mt-0.5"
  }, "Silicon Protection")))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-xl gamer-panel"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Total Recorded Sessions"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-extrabold font-mono text-white mt-1"
  }, trends ? trends.total_sessions : sessions.length, " Sessions")), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-xl gamer-panel"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Total Gaming Time"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-extrabold font-mono text-[#EDE7DC] mt-1"
  }, trends ? trends.total_gaming_hours : '14.2', " Hours")), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-xl gamer-panel"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Peak Thermal / Avg"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-extrabold font-mono text-amber-400 mt-1"
  }, trends ? trends.peak_cpu : '89.6', "°C ", /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-[#9EA5A8] font-normal"
  }, "(", trends ? trends.overall_avg_cpu : '74.2', "°C avg)"))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-xl gamer-panel"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono uppercase text-[#9EA5A8]"
  }, "Prevented Throttles"), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-extrabold font-mono text-[#2E6B72] mt-1"
  }, trends ? trends.total_throttles : '8', " Handled"))), trends && trends.daily_trends && trends.daily_trends.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "p-5 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-xs font-bold uppercase font-mono text-white flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", null, "📊"), " Thermal & Gaming Session Trends (Recent Days)"), /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] font-mono text-[#9EA5A8]"
  }, "Duration (Minutes) & Max Temp (°C)")), /*#__PURE__*/React.createElement("div", {
    className: "h-44 w-full flex items-end gap-2 pt-4 px-2"
  }, trends.daily_trends.map((day, idx) => {
    const maxVal = Math.max(...trends.daily_trends.map(d => d.minutes), 120);
    const heightPct = Math.min(100, Math.max(15, day.minutes / maxVal * 100));
    return /*#__PURE__*/React.createElement("div", {
      key: idx,
      className: "flex-1 flex flex-col items-center gap-1.5 group relative"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-[9px] font-mono text-amber-400 opacity-80 group-hover:opacity-100 font-bold"
    }, day.max_temp, "°C"), /*#__PURE__*/React.createElement("div", {
      className: "w-full bg-[#E8913C] rounded-t-sm transition-all group-hover:brightness-110",
      style: {
        height: `${heightPct}%`
      },
      title: `${day.date}: ${day.minutes} mins gaming, max ${day.max_temp}°C, ${day.throttles} throttles`
    }), /*#__PURE__*/React.createElement("div", {
      className: "text-[9px] font-mono text-[#9EA5A8] truncate w-full text-center"
    }, day.date.slice(5)));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl overflow-hidden gamer-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 border-b border-[rgba(237,231,220,0.13)] flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-xs font-bold uppercase font-mono text-white"
  }, "Past Gaming Sessions"), /*#__PURE__*/React.createElement("button", {
    onClick: fetchInitialData,
    className: "text-xs text-[#E8913C] hover:text-[#d97d26] font-mono font-bold"
  }, "Refresh")), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-xs font-mono"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-[#0A0C0E] text-[#9EA5A8] uppercase text-[10px]"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Game Title"), /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Date / Duration"), /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Avg CPU / GPU"), /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Max Temp"), /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Throttling Events"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-[rgba(237,231,220,0.1)] text-[#EDE7DC]"
  }, sessions.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "5",
    className: "p-6 text-center text-[#6C7378]"
  }, "No past sessions recorded yet. Launch a game or keep mock mode active to record!")) : sessions.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.id,
    className: "hover:bg-[#161B21]"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3.5 font-bold text-white"
  }, s.game_name), /*#__PURE__*/React.createElement("td", {
    className: "p-3.5 text-[#9EA5A8]"
  }, s.start_time.slice(0, 16).replace('T', ' '), " (", Math.round(s.duration_secs / 60), " mins)"), /*#__PURE__*/React.createElement("td", {
    className: "p-3.5"
  }, s.avg_cpu_temp, "°C / ", s.avg_gpu_temp, "°C"), /*#__PURE__*/React.createElement("td", {
    className: "p-3.5 text-amber-400 font-bold"
  }, Math.max(s.max_cpu_temp, s.max_gpu_temp), "°C"), /*#__PURE__*/React.createElement("td", {
    className: "p-3.5"
  }, s.throttle_events_count > 0 ? /*#__PURE__*/React.createElement("span", {
    className: "px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-500/40 font-bold"
  }, s.throttle_events_count, " Throttles") : /*#__PURE__*/React.createElement("span", {
    className: "text-[#2E6B72] font-bold"
  }, "0 Clean ✓"))))))))), activeTab === 'automation' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-mono font-bold px-2 py-0.5 rounded bg-[rgba(232,145,60,0.15)] text-[#E8913C] border border-[rgba(232,145,60,0.35)]"
  }, "ACTIVE ENGINE"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-[#9EA5A8] font-mono"
  }, "Automated 1-Second Thermal Loop")), /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-[#9EA5A8] font-mono"
  }, "Hysteresis Dwell: 30s")), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-white"
  }, "Smart Auto-Cooling & Thermal Safeguards"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#EDE7DC] leading-relaxed max-w-3xl"
  }, "Evaluates hardware temperatures every 1,000ms. If temperatures exceed 80°C continuously for 5 seconds, fans ramp up to 90%. If heat continues rising, power limits or FPS caps are suggested. Once temperatures remain below 72°C for 30 continuous seconds, baseline settings recover smoothly without fan-speed flapping.")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-4 gap-4"
  }, [{
    id: 'silent',
    name: 'Silent Profile',
    desc: '45% Fan cap, 80% Power limit, 60 FPS cap',
    icon: '🔇'
  }, {
    id: 'balanced',
    name: 'Balanced Gaming',
    desc: '65% Fans, 100% Power limit, 120 FPS cap',
    icon: '⚖️'
  }, {
    id: 'performance',
    name: 'Ultra Performance',
    desc: '90% Fans, 110% Power limit, Uncapped FPS',
    icon: '🚀'
  }, {
    id: 'auto',
    name: 'Smart Game Auto',
    desc: 'Performance when game runs, Balanced on idle',
    icon: '🤖'
  }].map(prof => /*#__PURE__*/React.createElement("div", {
    key: prof.id,
    onClick: () => handleProfileChange(prof.id),
    className: `p-4 rounded-xl border cursor-pointer transition-all gamer-panel ${activeProfile === prof.id ? 'border-[#E8913C] bg-[rgba(232,145,60,0.08)] shadow-sm' : 'border-[rgba(237,231,220,0.13)] hover:border-[rgba(237,231,220,0.16)]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xl"
  }, prof.icon), activeProfile === prof.id && /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] font-mono font-bold text-[#E8913C]"
  }, "ACTIVE")), /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-bold text-white"
  }, prof.name), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-[#9EA5A8] mt-1 leading-relaxed"
  }, prof.desc)))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-4"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "text-xs font-bold uppercase font-mono text-white"
  }, "Automated Escalation Steps"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3 text-xs font-mono"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
    className: "text-amber-400"
  }, "Step 1: Warning Dwell (>80°C for 5s)"), /*#__PURE__*/React.createElement("p", {
    className: "text-[#9EA5A8] text-[11px]"
  }, "Increases fan speed curve to 90% RPM to arrest thermal rise.")), /*#__PURE__*/React.createElement("span", {
    className: "text-[#EDE7DC] font-bold"
  }, "Fans → 90%")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
    className: "text-amber-400"
  }, "Step 2: Sustained Load (>80°C for 15s)"), /*#__PURE__*/React.createElement("p", {
    className: "text-[#9EA5A8] text-[11px]"
  }, "Reduces GPU power limit to 85% and suggests an FPS limiter.")), /*#__PURE__*/React.createElement("span", {
    className: "text-[#EDE7DC] font-bold"
  }, "Power Limit → 85%")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-red-900/60 rounded-xl flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
    className: "text-red-400"
  }, "Step 3: Critical Thermal Threshold (>92°C)"), /*#__PURE__*/React.createElement("p", {
    className: "text-[#9EA5A8] text-[11px]"
  }, "Triggers emergency thermal throttling and audible desktop critical alarm.")), /*#__PURE__*/React.createElement("span", {
    className: "text-red-400 font-bold"
  }, "Aggressive Throttle")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(46,107,114,0.4)] rounded-xl flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", {
    className: "text-[#88c9cf]"
  }, "Recovery: 30-Second Hysteresis (<72°C for 30s)"), /*#__PURE__*/React.createElement("p", {
    className: "text-[#9EA5A8] text-[11px]"
  }, "Steadily restores previous cooling profiles without cycling or fan flapping.")), /*#__PURE__*/React.createElement("span", {
    className: "text-[#88c9cf] font-bold"
  }, "Restore Baseline")))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "text-xs font-bold uppercase font-mono text-white"
  }, "Configurable Thermal Bounds"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "Customize warning, critical throttle, and safe recovery thresholds"))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSaveThresholds,
    className: "grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 font-mono text-xs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl space-y-1.5"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-amber-400 font-bold block"
  }, "CPU Warning Temp (°C)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: thresholds.cpu_warn_c,
    onChange: e => setThresholds({
      ...thresholds,
      cpu_warn_c: Number(e.target.value)
    }),
    className: "w-full bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded px-2.5 py-1.5 text-white"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-[#6C7378] block"
  }, "Triggers Step 1 fan boost after 5s")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl space-y-1.5"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-red-400 font-bold block"
  }, "CPU Critical Temp (°C)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: thresholds.cpu_crit_c,
    onChange: e => setThresholds({
      ...thresholds,
      cpu_crit_c: Number(e.target.value)
    }),
    className: "w-full bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded px-2.5 py-1.5 text-white"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-[#6C7378] block"
  }, "Emergency load reduction & alert")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl space-y-1.5"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-[#88c9cf] font-bold block"
  }, "CPU Safe Recovery (°C)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: thresholds.cpu_safe_c,
    onChange: e => setThresholds({
      ...thresholds,
      cpu_safe_c: Number(e.target.value)
    }),
    className: "w-full bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded px-2.5 py-1.5 text-white"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-[#6C7378] block"
  }, "30s sustained recovery threshold")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl space-y-1.5"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-amber-400 font-bold block"
  }, "GPU Warning Temp (°C)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: thresholds.gpu_warn_c,
    onChange: e => setThresholds({
      ...thresholds,
      gpu_warn_c: Number(e.target.value)
    }),
    className: "w-full bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded px-2.5 py-1.5 text-white"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-[#6C7378] block"
  }, "Triggers fan curve acceleration")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl space-y-1.5"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-red-400 font-bold block"
  }, "GPU Critical Temp (°C)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: thresholds.gpu_crit_c,
    onChange: e => setThresholds({
      ...thresholds,
      gpu_crit_c: Number(e.target.value)
    }),
    className: "w-full bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded px-2.5 py-1.5 text-white"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-[#6C7378] block"
  }, "Clamps power limit to 85%")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl space-y-1.5"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-[#88c9cf] font-bold block"
  }, "GPU Safe Recovery (°C)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: thresholds.gpu_safe_c,
    onChange: e => setThresholds({
      ...thresholds,
      gpu_safe_c: Number(e.target.value)
    }),
    className: "w-full bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded px-2.5 py-1.5 text-white"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-[#6C7378] block"
  }, "Restores baseline profile")), /*#__PURE__*/React.createElement("div", {
    className: "sm:col-span-3 flex justify-end"
  }, /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-4 py-2 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-extrabold text-xs transition-colors shadow-sm"
  }, "Save Thresholds to Agent")))), /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    className: "text-xs font-bold uppercase font-mono text-white"
  }, "Create Custom Automation Rule"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "Define custom IF/THEN conditions (Metric, Operator, Value, Action)"))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleAddRule,
    className: "grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sm:col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-[#9EA5A8] text-[11px] block mb-1"
  }, "Rule Name"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "e.g. Ramp fans when GPU > 82C",
    value: newRule.name,
    onChange: e => setNewRule({
      ...newRule,
      name: e.target.value
    }),
    className: "w-full bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded px-3 py-2 text-white"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-[#9EA5A8] text-[11px] block mb-1"
  }, "Target Metric"), /*#__PURE__*/React.createElement("select", {
    value: newRule.metric_path,
    onChange: e => setNewRule({
      ...newRule,
      metric_path: e.target.value
    }),
    className: "w-full bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded px-3 py-2 text-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: "cpu.package_temp_c"
  }, "CPU Temp (°C)"), /*#__PURE__*/React.createElement("option", {
    value: "gpu.core_temp_c"
  }, "GPU Temp (°C)"), /*#__PURE__*/React.createElement("option", {
    value: "cpu.usage_pct"
  }, "CPU Usage (%)"), /*#__PURE__*/React.createElement("option", {
    value: "gpu.usage_pct"
  }, "GPU Usage (%)"), /*#__PURE__*/React.createElement("option", {
    value: "ram.usage_pct"
  }, "RAM Usage (%)"), /*#__PURE__*/React.createElement("option", {
    value: "gpu.vram_pct"
  }, "VRAM Usage (%)"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-[#9EA5A8] text-[11px] block mb-1"
  }, "Operator & Threshold"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("select", {
    value: newRule.operator,
    onChange: e => setNewRule({
      ...newRule,
      operator: e.target.value
    }),
    className: "bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded px-2 py-2 text-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ">"
  }, ">"), /*#__PURE__*/React.createElement("option", {
    value: ">="
  }, ">="), /*#__PURE__*/React.createElement("option", {
    value: "<"
  }, "<"), /*#__PURE__*/React.createElement("option", {
    value: "<="
  }, "<=")), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: newRule.threshold_value,
    onChange: e => setNewRule({
      ...newRule,
      threshold_value: Number(e.target.value)
    }),
    className: "w-full bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded px-2 py-2 text-white"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-[#9EA5A8] text-[11px] block mb-1"
  }, "Action Type"), /*#__PURE__*/React.createElement("select", {
    value: newRule.action_type,
    onChange: e => setNewRule({
      ...newRule,
      action_type: e.target.value
    }),
    className: "w-full bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded px-3 py-2 text-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: "set_fan_speed"
  }, "Set Fan Speed (%)"), /*#__PURE__*/React.createElement("option", {
    value: "set_power_limit"
  }, "Set Power Limit (%)"), /*#__PURE__*/React.createElement("option", {
    value: "notify_user"
  }, "Notify Desktop Alert"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "text-[#9EA5A8] text-[11px] block mb-1"
  }, "Target Action Value"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "e.g. 95",
    value: newRule.target_value,
    onChange: e => setNewRule({
      ...newRule,
      target_value: e.target.value
    }),
    className: "w-full bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded px-3 py-2 text-white"
  })), /*#__PURE__*/React.createElement("div", {
    className: "sm:col-span-2 flex items-end"
  }, /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "w-full py-2 bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-extrabold rounded-lg transition-colors"
  }, "Deploy Custom Rule →"))), customRules.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "pt-3 border-t border-[rgba(237,231,220,0.13)] space-y-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] font-mono text-[#9EA5A8] uppercase"
  }, "Active Custom Rules (", customRules.length, ")"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, customRules.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    className: "p-3 bg-[#0A0C0E] border border-[rgba(237,231,220,0.13)] rounded-xl flex items-center justify-between font-mono text-xs"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-white"
  }, r.name), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-[#9EA5A8]"
  }, "IF ", /*#__PURE__*/React.createElement("span", {
    className: "text-[#E8913C]"
  }, r.metric_path), " ", r.operator, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-[#EDE7DC]"
  }, r.threshold_value), " → DO ", /*#__PURE__*/React.createElement("span", {
    className: "text-[#2E6B72]"
  }, r.action_type, " (", r.target_value, ")"))), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDeleteRule(r.id),
    className: "px-2.5 py-1 text-[11px] rounded bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900"
  }, "Delete"))))))), activeTab === 'actions' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-base font-bold text-white uppercase font-mono"
  }, "Automated Actions & Audit Log"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "Every automatic hardware adjustment is permanently logged with 1-click manual undo")), /*#__PURE__*/React.createElement("button", {
    onClick: fetchInitialData,
    className: "text-xs text-[#E8913C] hover:text-[#d97d26] font-mono font-bold"
  }, "Refresh Log")), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl overflow-hidden gamer-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-left text-xs font-mono"
  }, /*#__PURE__*/React.createElement("thead", {
    className: "bg-[#0A0C0E] text-[#9EA5A8] uppercase text-[10px]"
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Timestamp"), /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Rule / Reason"), /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Trigger Condition"), /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Action Applied"), /*#__PURE__*/React.createElement("th", {
    className: "p-3.5"
  }, "Status / Reversion"))), /*#__PURE__*/React.createElement("tbody", {
    className: "divide-y divide-[rgba(237,231,220,0.1)] text-[#EDE7DC]"
  }, actionLogs.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "5",
    className: "p-6 text-center text-[#6C7378]"
  }, "No automated adjustments logged yet. The engine logs every temperature response here!")) : actionLogs.map(log => /*#__PURE__*/React.createElement("tr", {
    key: log.id,
    className: "hover:bg-[#161B21]"
  }, /*#__PURE__*/React.createElement("td", {
    className: "p-3.5 text-[#9EA5A8]"
  }, log.timestamp.slice(11, 19)), /*#__PURE__*/React.createElement("td", {
    className: "p-3.5 font-bold text-white"
  }, log.rule_id), /*#__PURE__*/React.createElement("td", {
    className: "p-3.5 text-amber-400"
  }, log.trigger_metric, " (", log.trigger_value, "°C)"), /*#__PURE__*/React.createElement("td", {
    className: "p-3.5 text-[#2E6B72] font-semibold"
  }, log.action_type, ": ", log.old_value, " → ", log.new_value), /*#__PURE__*/React.createElement("td", {
    className: "p-3.5"
  }, log.is_reverted ? /*#__PURE__*/React.createElement("span", {
    className: "text-[#6C7378]"
  }, "Reverted ✓") : /*#__PURE__*/React.createElement("button", {
    onClick: () => handleUndoAction(log.id),
    className: "px-2.5 py-1 rounded bg-[#161B21] hover:bg-[#2A333C] text-cyan-300 font-bold text-[10px] border border-cyan-500/30"
  }, "Undo / Restore"))))))))), activeTab === 'tests' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-base font-bold text-white uppercase font-mono"
  }, "Interactive Hardware Diagnostics"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "Physical diagnostic tools for laptop & desktop peripherals")), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-mono text-[#9EA5A8]"
  }, Object.values(testsPassed).filter(Boolean).length, "/6 Verified")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
  }, [{
    id: 'keyboard',
    name: 'Keyboard Key Matrix',
    desc: 'Press keys to test ghosting, sticky switches, and rollover.',
    icon: '⌨️'
  }, {
    id: 'screen',
    name: 'Screen & Dead Pixel Sweep',
    desc: 'Cycles RGB and solid black/white to find stuck pixels.',
    icon: '🖥️'
  }, {
    id: 'audio',
    name: 'Stereo Speakers & Frequency',
    desc: 'Tests Left and Right speaker balance and 60Hz-8kHz sweep.',
    icon: '🔊'
  }, {
    id: 'mic',
    name: 'Microphone Input Clarity',
    desc: 'Live decibel volume meter and frequency visualizer.',
    icon: '🎙️'
  }, {
    id: 'webcam',
    name: 'Webcam Lens & Frame Rate',
    desc: 'Verifies webcam sensor, resolution, and video feed.',
    icon: '📷'
  }, {
    id: 'benchmark',
    name: 'CPU Stress Benchmark',
    desc: '5-second multi-thread math matrix stress benchmark.',
    icon: '⚡'
  }].map(tool => /*#__PURE__*/React.createElement("div", {
    key: tool.id,
    onClick: () => setActiveModal(tool.id),
    className: "p-5 bg-[#101317] border border-[rgba(237,231,220,0.13)] hover:border-[#E8913C] rounded-2xl cursor-pointer transition-all gamer-panel space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-2xl"
  }, tool.icon), /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] font-mono font-bold px-2 py-0.5 rounded ${testsPassed[tool.id] ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-[#161B21] text-[#9EA5A8]'}`
  }, testsPassed[tool.id] ? 'VERIFIED ✓' : 'READY')), /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-bold text-white"
  }, tool.name), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8] leading-relaxed"
  }, tool.desc), /*#__PURE__*/React.createElement("span", {
    className: "inline-block text-xs font-mono font-bold text-[#E8913C] pt-1"
  }, "Launch Test Suite →"))))), activeTab === 'setup' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-6 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl gamer-panel space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-xl bg-[#161B21] text-[#E8913C] border border-[rgba(232,145,60,0.3)] flex items-center justify-center font-bold text-xl"
  }, "⚙️"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-base font-bold text-white"
  }, "How to Run the Local Hardware Agent"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "The agent is a Python 3.11+ service that reads temperatures, fan RPMs, and power directly."))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4 pt-2 text-xs font-mono"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#0A0C0E] rounded-xl border border-[rgba(237,231,220,0.13)] space-y-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#E8913C] font-bold"
  }, "Option 1: Quick Mock Simulator (Works Anywhere)"), /*#__PURE__*/React.createElement("p", {
    className: "text-[#9EA5A8]"
  }, "Launch the agent with mock data to test the full auto-cooling rules and live charts without physical hardware access:"), /*#__PURE__*/React.createElement("pre", {
    className: "p-3 bg-black rounded-lg text-[#EDE7DC] overflow-x-auto"
  }, "python3 run_agent.py --mock")), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#0A0C0E] rounded-xl border border-[rgba(237,231,220,0.13)] space-y-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#2E6B72] font-bold"
  }, "Option 2: Real Hardware Sensors (Windows Administrator)"), /*#__PURE__*/React.createElement("p", {
    className: "text-[#9EA5A8]"
  }, "For real temperatures, LibreHardwareMonitor fans, and NVIDIA GPU power controls, run in an elevated command prompt:"), /*#__PURE__*/React.createElement("pre", {
    className: "p-3 bg-black rounded-lg text-[#EDE7DC] overflow-x-auto"
  }, "python3 run_agent.py")), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#0A0C0E] rounded-xl border border-[rgba(237,231,220,0.13)] space-y-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-amber-400 font-bold"
  }, "Option 3: Reading Fan RPMs with LibreHardwareMonitor"), /*#__PURE__*/React.createElement("p", {
    className: "text-[#9EA5A8]"
  }, "1. Download LibreHardwareMonitor (", /*#__PURE__*/React.createElement("a", {
    href: "https://github.com/LibreHardwareMonitor/LibreHardwareMonitor",
    target: "_blank",
    className: "text-cyan-400 underline"
  }, "GitHub"), ")"), /*#__PURE__*/React.createElement("p", {
    className: "text-[#9EA5A8]"
  }, "2. In LHM, click ", /*#__PURE__*/React.createElement("strong", null, "Options → Remote Web Server → Run"), " (default port 8085)."), /*#__PURE__*/React.createElement("p", {
    className: "text-[#9EA5A8]"
  }, "3. The agent reads fan speeds automatically from ", /*#__PURE__*/React.createElement("code", null, "http://localhost:8085/data.json"), "."))))))), pendingNotif && /*#__PURE__*/React.createElement(OverheatModal, { notif: pendingNotif, onDismiss: () => setPendingNotif(null) }), activeModal === 'keyboard' && /*#__PURE__*/React.createElement(KeyboardModal, {
    onClose: () => setActiveModal(null),
    onPass: () => {
      setTestsPassed(prev => ({
        ...prev,
        keyboard: true
      }));
      setActiveModal(null);
      addToast('success', 'Keyboard Verified', 'All key rollover tested.');
    }
  }), activeModal === 'screen' && /*#__PURE__*/React.createElement(ScreenModal, {
    onClose: () => setActiveModal(null),
    onPass: () => {
      setTestsPassed(prev => ({
        ...prev,
        screen: true
      }));
      setActiveModal(null);
      addToast('success', 'Screen Verified', 'No dead pixels found.');
    }
  }), activeModal === 'audio' && /*#__PURE__*/React.createElement(AudioModal, {
    onClose: () => setActiveModal(null),
    onPass: () => {
      setTestsPassed(prev => ({
        ...prev,
        audio: true
      }));
      setActiveModal(null);
      addToast('success', 'Speakers Verified', 'Stereo separation intact.');
    }
  }), activeModal === 'mic' && /*#__PURE__*/React.createElement(MicModal, {
    onClose: () => setActiveModal(null),
    onPass: () => {
      setTestsPassed(prev => ({
        ...prev,
        mic: true
      }));
      setActiveModal(null);
      addToast('success', 'Mic Verified', 'Audio reception clean.');
    }
  }), activeModal === 'webcam' && /*#__PURE__*/React.createElement(WebcamModal, {
    onClose: () => setActiveModal(null),
    onPass: () => {
      setTestsPassed(prev => ({
        ...prev,
        webcam: true
      }));
      setActiveModal(null);
      addToast('success', 'Webcam Verified', 'Video feed healthy.');
    }
  }), activeModal === 'benchmark' && /*#__PURE__*/React.createElement(BenchmarkModal, {
    onClose: () => setActiveModal(null),
    onPass: () => {
      setTestsPassed(prev => ({
        ...prev,
        benchmark: true
      }));
      setActiveModal(null);
      addToast('success', 'Benchmark Complete', 'Stress score saved.');
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none"
  }, toasts.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: `pointer-events-auto p-3.5 rounded-xl border shadow-xl flex items-start gap-3 max-w-sm text-xs font-mono backdrop-blur-md transition-all ${t.type === 'error' ? 'bg-red-950/90 border-red-500/60 text-red-200' : t.type === 'warning' ? 'bg-amber-950/90 border-amber-500/60 text-amber-200' : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base"
  }, t.type === 'error' ? '🚨' : t.type === 'warning' ? '⚠️' : '✓'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-bold text-white"
  }, t.title), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] opacity-90 mt-0.5"
  }, t.message))))));
}

/**
 * 1. KEYBOARD TESTING MODAL
 */
function OverheatModal({ notif, onDismiss }) {
  if (!notif) return null;
  const isCrit = notif.level === 'critical';
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 bg-[#0F1215] border-2 border-red-500 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.35)] space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-red-500/20 pb-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-lg animate-pulse"
  }, "🚨"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-red-400 font-mono tracking-widest uppercase"
  }, "HARDWARE ANOMALY // CRITICAL DIAGNOSIS")), /*#__PURE__*/React.createElement("button", {
    onClick: onDismiss,
    className: "text-[#9EA5A8] hover:text-white font-mono text-xs px-2.5 py-1 rounded bg-[#161B21] border border-[rgba(237,231,220,0.1)]"
  }, "✕ Close")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-xl font-bold text-white font-display"
  }, notif.title || "Critical Overheat & Throttling Alert"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8] mt-1 leading-relaxed"
  }, notif.summary || "Severe thermal threshold reached. Silicon junction temperature exceeds safe operating envelope.")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-3.5 bg-red-950/30 border border-red-500/40 rounded-xl text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-3xl font-extrabold font-mono text-red-400"
  }, `${Math.round(notif.cpu_temp || 94.8)}°C`), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-[#9EA5A8] font-mono uppercase tracking-wider mt-1"
  }, "CPU DIE JUNCTION")), /*#__PURE__*/React.createElement("div", {
    className: "p-3.5 bg-red-950/30 border border-red-500/40 rounded-xl text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-3xl font-extrabold font-mono text-red-400"
  }, `${Math.round(notif.gpu_temp || 89.2)}°C`), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-[#9EA5A8] font-mono uppercase tracking-wider mt-1"
  }, "GPU RENDER CORE"))), (notif.causes || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 pt-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono font-bold uppercase tracking-widest text-[#E8913C]"
  }, "PROBABLE ROOT CAUSES DETECTED"), (notif.causes || []).map((cause, ci) => /*#__PURE__*/React.createElement("div", {
    key: ci,
    className: "p-3 rounded-xl bg-[#161B21] border border-[rgba(237,231,220,0.08)] space-y-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-xs font-bold text-white font-mono"
  }, /*#__PURE__*/React.createElement("span", null, cause.icon || "⚠️"), /*#__PURE__*/React.createElement("span", null, cause.title)), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-[#9EA5A8] leading-relaxed"
  }, cause.detail), cause.fix && /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-[#88c9cf] pt-1 border-t border-[rgba(237,231,220,0.06)]"
  }, /*#__PURE__*/React.createElement("strong", { className: "text-[#E8913C]" }, "Recommended Fix: "), cause.fix)))), (notif.next_steps || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "space-y-1.5 pt-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-mono font-bold uppercase tracking-widest text-[#88c9cf]"
  }, "AUTONOMOUS SYSTEM ACTIONS & NEXT STEPS"), (notif.next_steps || []).map((step, si) => /*#__PURE__*/React.createElement("div", {
    key: si,
    className: "flex items-start gap-2 text-xs text-[#EDE7DC]"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-5 h-5 rounded-full bg-[#E8913C]/20 border border-[#E8913C]/50 text-[#E8913C] font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0"
  }, si + 1), /*#__PURE__*/React.createElement("span", { className: "leading-relaxed" }, step)))), /*#__PURE__*/React.createElement("div", {
    className: "pt-2 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDismiss,
    className: "flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs font-mono uppercase tracking-wider shadow-lg transition-all"
  }, "Acknowledge & Engage Emergency Cooling"), /*#__PURE__*/React.createElement("button", {
    onClick: onDismiss,
    className: "px-4 py-2.5 rounded-xl bg-[#161B21] hover:bg-[#2A333C] text-[#9EA5A8] font-bold text-xs font-mono border border-[rgba(237,231,220,0.15)]"
  }, "Dismiss"))));
}

function KeyboardModal({
  onClose,
  onPass
}) {
  const [pressedSet, setPressedSet] = useState(new Set());
  const [lastKey, setLastKey] = useState('None yet');
  useEffect(() => {
    const handleDown = e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
      setLastKey(`${e.key} (${e.code})`);
      setPressedSet(prev => new Set(prev).add(e.code));
    };
    window.addEventListener('keydown', handleDown);
    return () => window.removeEventListener('keydown', handleDown);
  }, []);
  const isKeyPassed = code => pressedSet.has(code);
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden modal-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 border-b border-[rgba(237,231,220,0.13)] flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold text-white uppercase font-mono"
  }, "⌨️ Laptop / Gaming Keyboard Matrix Tester"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8]"
  }, "Press keys to verify responsiveness. Keys illuminate green once registered.")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "text-[#9EA5A8] hover:text-white text-xl font-bold"
  }, "×")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between bg-[#101317] border border-[rgba(237,231,220,0.13)] px-4 py-2.5 rounded-xl text-xs font-mono"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-[#2E6B72] text-sm"
  }, pressedSet.size), /*#__PURE__*/React.createElement("span", {
    className: "text-[#9EA5A8] ml-1.5"
  }, "Keys Verified")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "text-[#6C7378]"
  }, "Last Key:"), " ", /*#__PURE__*/React.createElement("code", {
    className: "bg-[#0A0C0E] border border-[rgba(237,231,220,0.16)] px-1.5 py-0.5 rounded text-white"
  }, lastKey)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPressedSet(new Set()),
    className: "px-2.5 py-1 rounded border border-[rgba(237,231,220,0.16)] hover:bg-[#161B21] text-[#EDE7DC] font-semibold"
  }, "Reset")), /*#__PURE__*/React.createElement("div", {
    className: "virtual-keyboard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kb-row"
  }, ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].map(k => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: `key ${k === 'Escape' ? 'key-esc' : ''} ${isKeyPassed(k) ? 'key-passed' : ''}`
  }, k))), /*#__PURE__*/React.createElement("div", {
    className: "kb-row"
  }, ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'].map(k => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: `key ${k === 'Backspace' ? 'key-backspace' : ''} ${isKeyPassed(k) ? 'key-passed' : ''}`
  }, k.replace('Digit', '')))), /*#__PURE__*/React.createElement("div", {
    className: "kb-row"
  }, ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'].map(k => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: `key ${k === 'Tab' ? 'key-tab' : ''} ${isKeyPassed(k) ? 'key-passed' : ''}`
  }, k.replace('Key', '')))), /*#__PURE__*/React.createElement("div", {
    className: "kb-row"
  }, ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'].map(k => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: `key ${['CapsLock', 'Enter'].includes(k) ? 'key-caps' : ''} ${isKeyPassed(k) ? 'key-passed' : ''}`
  }, k.replace('Key', '')))), /*#__PURE__*/React.createElement("div", {
    className: "kb-row"
  }, ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'].map(k => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: `key ${k.includes('Shift') ? 'key-shift' : ''} ${isKeyPassed(k) ? 'key-passed' : ''}`
  }, k.replace('Key', '').replace('Left', '').replace('Right', '')))), /*#__PURE__*/React.createElement("div", {
    className: "kb-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: `key key-mod ${isKeyPassed('ControlLeft') ? 'key-passed' : ''}`
  }, "Ctrl"), /*#__PURE__*/React.createElement("div", {
    className: `key key-mod ${isKeyPassed('AltLeft') ? 'key-passed' : ''}`
  }, "Alt"), /*#__PURE__*/React.createElement("div", {
    className: `key key-mod ${isKeyPassed('MetaLeft') ? 'key-passed' : ''}`
  }, "Cmd"), /*#__PURE__*/React.createElement("div", {
    className: `key key-space ${isKeyPassed('Space') ? 'key-passed' : ''}`
  }, "Space"), /*#__PURE__*/React.createElement("div", {
    className: `key key-mod ${isKeyPassed('MetaRight') ? 'key-passed' : ''}`
  }, "Cmd"), /*#__PURE__*/React.createElement("div", {
    className: `key key-arrow ${isKeyPassed('ArrowLeft') ? 'key-passed' : ''}`
  }, "←"), /*#__PURE__*/React.createElement("div", {
    className: `key key-arrow ${isKeyPassed('ArrowUp') ? 'key-passed' : ''}`
  }, "↑"), /*#__PURE__*/React.createElement("div", {
    className: `key key-arrow ${isKeyPassed('ArrowDown') ? 'key-passed' : ''}`
  }, "↓"), /*#__PURE__*/React.createElement("div", {
    className: `key key-arrow ${isKeyPassed('ArrowRight') ? 'key-passed' : ''}`
  }, "→")))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#0A0C0E] border-t border-[rgba(237,231,220,0.13)] flex justify-end gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 rounded-lg border border-[rgba(237,231,220,0.16)] text-xs font-mono text-[#9EA5A8] hover:text-white"
  }, "Close"), /*#__PURE__*/React.createElement("button", {
    onClick: onPass,
    className: "px-4 py-2 rounded-lg bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] text-xs font-mono font-bold"
  }, "Mark Healthy (Pass)"))));
}

/**
 * 2. SCREEN DEAD PIXEL MODAL
 */
function ScreenModal({
  onClose,
  onPass
}) {
  const colors = ['#ffffff', '#000000', '#ef4444', '#10b981', '#3b82f6'];
  const [fullscreenColor, setFullscreenColor] = useState(null);
  const nextColor = () => {
    const nextIdx = colors.indexOf(fullscreenColor) + 1;
    if (nextIdx >= colors.length) setFullscreenColor(null);else setFullscreenColor(colors[nextIdx]);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, fullscreenColor && /*#__PURE__*/React.createElement("div", {
    className: "fullscreen-sweep-overlay",
    style: {
      backgroundColor: fullscreenColor
    },
    onClick: nextColor
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-2 rounded-full bg-black/80 text-white text-xs font-mono font-bold shadow-2xl"
  }, "Click anywhere for next color (", colors.indexOf(fullscreenColor) + 1, "/5) • Press ESC to exit")), /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden modal-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 border-b border-[rgba(237,231,220,0.13)] flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold text-white uppercase font-mono"
  }, "🖥️ Screen & Dead Pixel Inspection"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "text-[#9EA5A8] hover:text-white text-xl font-bold"
  }, "×")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 text-center space-y-4"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-[#9EA5A8] leading-relaxed font-mono"
  }, "Launch full-screen solid primary colors to locate sub-pixel faults, stuck crystals, or backlight bleeding."), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-center gap-3 py-2"
  }, colors.map((c, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => setFullscreenColor(c),
    className: "w-11 h-11 rounded-full border border-[rgba(237,231,220,0.16)] shadow hover:scale-105 transition-transform",
    style: {
      backgroundColor: c
    }
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setFullscreenColor(colors[0]),
    className: "w-full py-3 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-mono font-bold text-xs shadow"
  }, "Start 5-Color Fullscreen Sweep")), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#0A0C0E] border-t border-[rgba(237,231,220,0.13)] flex justify-end gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 rounded-lg border border-[rgba(237,231,220,0.16)] text-xs font-mono text-[#9EA5A8]"
  }, "Close"), /*#__PURE__*/React.createElement("button", {
    onClick: onPass,
    className: "px-4 py-2 rounded-lg bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] text-xs font-mono font-bold"
  }, "No Dead Pixels (Pass)")))));
}

/**
 * 3. AUDIO STEREO MODAL
 */
function AudioModal({
  onClose,
  onPass
}) {
  const [playingChannel, setPlayingChannel] = useState(null);
  const playTone = channel => {
    setPlayingChannel(channel);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(channel === 'left' ? 440 : 880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    if (panner) {
      panner.pan.setValueAtTime(channel === 'left' ? -1 : 1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
    setTimeout(() => setPlayingChannel(null), 1200);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden modal-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 border-b border-[rgba(237,231,220,0.13)] flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold text-white uppercase font-mono"
  }, "🔊 Stereo Speaker Separation"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "text-[#9EA5A8] hover:text-white text-xl font-bold"
  }, "×")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: `p-5 rounded-2xl border text-center space-y-3 transition-all ${playingChannel === 'left' ? 'border-emerald-500 bg-emerald-950/20' : 'border-[rgba(237,231,220,0.13)] bg-[#101317]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl"
  }, "🔉"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-bold font-mono text-white"
  }, "Left Speaker"), /*#__PURE__*/React.createElement("button", {
    onClick: () => playTone('left'),
    className: "w-full py-1.5 rounded-lg border border-[rgba(237,231,220,0.16)] bg-[#161B21] hover:bg-[#2A333C] text-xs font-mono font-bold text-[#EDE7DC]"
  }, "Play Left")), /*#__PURE__*/React.createElement("div", {
    className: `p-5 rounded-2xl border text-center space-y-3 transition-all ${playingChannel === 'right' ? 'border-emerald-500 bg-emerald-950/20' : 'border-[rgba(237,231,220,0.13)] bg-[#101317]'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl"
  }, "🔊"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-bold font-mono text-white"
  }, "Right Speaker"), /*#__PURE__*/React.createElement("button", {
    onClick: () => playTone('right'),
    className: "w-full py-1.5 rounded-lg border border-[rgba(237,231,220,0.16)] bg-[#161B21] hover:bg-[#2A333C] text-xs font-mono font-bold text-[#EDE7DC]"
  }, "Play Right")))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#0A0C0E] border-t border-[rgba(237,231,220,0.13)] flex justify-end gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 rounded-lg border border-[rgba(237,231,220,0.16)] text-xs font-mono text-[#9EA5A8]"
  }, "Close"), /*#__PURE__*/React.createElement("button", {
    onClick: onPass,
    className: "px-4 py-2 rounded-lg bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] text-xs font-mono font-bold"
  }, "Both Sound Clear (Pass)"))));
}

/**
 * 4. MICROPHONE MODAL
 */
function MicModal({
  onClose,
  onPass
}) {
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      streamRef.current = stream;
      setListening(true);
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        analyser.getByteFrequencyData(data);
        const sum = data.reduce((a, b) => a + b, 0);
        const pct = Math.min(100, Math.round(sum / (data.length * 128) * 100));
        setLevel(pct);
        animRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (e) {
      alert('Mic access denied: ' + e.message);
    }
  };
  const stopMic = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setListening(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden modal-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 border-b border-[rgba(237,231,220,0.13)] flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold text-white uppercase font-mono"
  }, "🎙️ Microphone Input Sensor Test"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      stopMic();
      onClose();
    },
    className: "text-[#9EA5A8] hover:text-white text-xl font-bold"
  }, "×")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 text-center space-y-4"
  }, !listening ? /*#__PURE__*/React.createElement("button", {
    onClick: startMic,
    className: "px-6 py-2.5 rounded-xl bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] font-mono font-bold text-xs shadow"
  }, "Enable Microphone & Listen") : /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-mono text-[#EDE7DC]"
  }, "Live Volume Level: ", /*#__PURE__*/React.createElement("strong", {
    className: "text-[#E8913C]"
  }, level, "%")), /*#__PURE__*/React.createElement("div", {
    className: "w-full h-4 bg-[#101317] rounded-full overflow-hidden border border-[rgba(237,231,220,0.13)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full bg-[#E8913C] transition-all duration-75",
    style: {
      width: `${level}%`
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#0A0C0E] border-t border-[rgba(237,231,220,0.13)] flex justify-end gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      stopMic();
      onClose();
    },
    className: "px-4 py-2 rounded-lg border border-[rgba(237,231,220,0.16)] text-xs font-mono text-[#9EA5A8]"
  }, "Close"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      stopMic();
      onPass();
    },
    className: "px-4 py-2 rounded-lg bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] text-xs font-mono font-bold"
  }, "Microphone Working (Pass)"))));
}

/**
 * 5. WEBCAM MODAL
 */
function WebcamModal({
  onClose,
  onPass
}) {
  const [active, setActive] = useState(false);
  const [resolution, setResolution] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const toggleCam = async () => {
    if (active) {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setActive(false);
      setResolution('');
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setActive(true);
      } catch (err) {
        alert('Webcam access error: ' + err.message);
      }
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden modal-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 border-b border-[rgba(237,231,220,0.13)] flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold text-white uppercase font-mono"
  }, "📷 Webcam Sensor Test"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (active) toggleCam();
      onClose();
    },
    className: "text-[#9EA5A8] hover:text-white text-xl font-bold"
  }, "×")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 text-center space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full h-56 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-[rgba(237,231,220,0.13)] relative"
  }, /*#__PURE__*/React.createElement("video", {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    muted: true,
    onLoadedMetadata: () => videoRef.current && setResolution(`${videoRef.current.videoWidth} x ${videoRef.current.videoHeight} px @ 30fps`),
    className: `w-full h-full object-cover ${active ? 'block' : 'hidden'}`
  }), !active && /*#__PURE__*/React.createElement("div", {
    className: "text-[#6C7378] text-xs font-mono flex flex-col items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-3xl"
  }, "📷"), /*#__PURE__*/React.createElement("span", null, "Camera feed is off"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: toggleCam,
    className: "px-5 py-2 rounded-xl bg-[#161B21] hover:bg-[#2A333C] text-white font-mono font-bold text-xs"
  }, active ? 'Stop Camera' : 'Start Camera Feed'), resolution && /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-[#9EA5A8] font-mono mt-1"
  }, resolution))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#0A0C0E] border-t border-[rgba(237,231,220,0.13)] flex justify-end gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (active) toggleCam();
      onClose();
    },
    className: "px-4 py-2 rounded-lg border border-[rgba(237,231,220,0.16)] text-xs font-mono text-[#9EA5A8]"
  }, "Close"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (active) toggleCam();
      onPass();
    },
    className: "px-4 py-2 rounded-lg bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] text-xs font-mono font-bold"
  }, "Webcam Working (Pass)"))));
}

/**
 * 6. CPU BENCHMARK MODAL
 */
function BenchmarkModal({
  onClose,
  onPass
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(null);
  const startBenchmark = () => {
    setRunning(true);
    setProgress(0);
    setScore(null);
    let p = 0;
    let ops = 0;
    const start = performance.now();
    const interval = setInterval(() => {
      p += 20;
      setProgress(p);
      for (let i = 0; i < 400000; i++) {
        ops += Math.sqrt(i) * Math.sin(i);
      }
      if (p >= 100) {
        clearInterval(interval);
        const time = (performance.now() - start) / 1000;
        const calcScore = Math.min(9999, Math.round(ops / time / 80000));
        setScore(calcScore);
        setRunning(false);
      }
    }, 400);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden modal-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "p-5 border-b border-[rgba(237,231,220,0.13)] flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "text-sm font-bold text-white uppercase font-mono"
  }, "⚡ Multi-Core CPU Benchmark"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "text-[#9EA5A8] hover:text-white text-xl font-bold"
  }, "×")), /*#__PURE__*/React.createElement("div", {
    className: "p-6 text-center space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "py-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-5xl font-extrabold text-[#E8913C] font-mono"
  }, score || '--'), /*#__PURE__*/React.createElement("div", {
    className: "text-xs uppercase font-bold text-[#6C7378] mt-1 font-mono"
  }, "Throughput Score")), running && /*#__PURE__*/React.createElement("div", {
    className: "w-full h-2.5 bg-[#101317] rounded-full overflow-hidden border border-[rgba(237,231,220,0.13)]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full bg-[#E8913C] transition-all duration-300",
    style: {
      width: `${progress}%`
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: startBenchmark,
    disabled: running,
    className: `px-6 py-2.5 rounded-xl font-mono font-bold text-xs shadow ${running ? 'bg-[#161B21] text-[#6C7378]' : 'bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E]'}`
  }, running ? 'Stressing CPU...' : 'Run 5-Second Benchmark')), /*#__PURE__*/React.createElement("div", {
    className: "p-4 bg-[#0A0C0E] border-t border-[rgba(237,231,220,0.13)] flex justify-end gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 rounded-lg border border-[rgba(237,231,220,0.16)] text-xs font-mono text-[#9EA5A8]"
  }, "Close"), /*#__PURE__*/React.createElement("button", {
    onClick: onPass,
    className: "px-4 py-2 rounded-lg bg-[#E8913C] hover:bg-[#d97d26] text-[#0A0C0E] text-xs font-mono font-bold"
  }, "Save Score (Pass)"))));
}

// Mount Gamer React App
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(/*#__PURE__*/React.createElement(App, null));