/**
 * ============================================================
 * 个人博客主页 - 核心逻辑
 * ============================================================
 *
 * 功能模块：
 * 1. GitHub API 数据获取（头像、简介、仓库列表）
 * 2. 隐藏触发器（快速点击标题 6 次 / 页脚隐藏像素点）
 * 3. 光敏警告弹窗
 * 4. Glitch 过渡动画（Canvas 噪点 + CSS 动画联动）
 * 5. 恐怖模式交互（光标残留、随机闪烁、黑屏 jump scare）
 * 6. Web Audio API 合成恐怖环境音效
 *
 * ⚠️ 光敏性癫痫警告 (Photosensitive Epilepsy Warning)
 * 恐怖模式包含快速闪烁、屏幕抖动、颜色反转
 * 相关代码以 [EPILEPSY-RISK] 标记
 * ============================================================
 */

'use strict';

/* ============================================================
   GitHub 配置
   ============================================================ */
const GITHUB_USERNAME = 'LING71671';
const GITHUB_API_BASE = 'https://api.github.com';
const MAX_REPOS = 6;

/* ============================================================
   全局状态变量
   ============================================================ */
let isHorrorMode = false;          // 当前是否为恐怖模式
let horrorIntervalIds = [];        // 恐怖模式定时器 ID 集合
let noiseAnimFrameId = null;       // 噪点动画帧 ID
let audioContext = null;           // Web Audio API 上下文
let audioNodes = [];               // 音频节点集合（用于清理）
let cursorTrailsEnabled = false;   // 光标残留是否启用

/* ============================================================
   1. GitHub API 数据获取
   ============================================================ */

/**
 * 获取用户信息（头像、简介）
 */
async function fetchUserProfile() {
  try {
    const res = await fetch(`${GITHUB_API_BASE}/users/${GITHUB_USERNAME}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // 填充头像
    const avatarEl = document.getElementById('avatar');
    avatarEl.src = data.avatar_url;
    avatarEl.alt = `${data.login} 的头像`;

    // 填充用户名
    document.getElementById('username').textContent = data.login;

    // 填充简介
    const bioEl = document.getElementById('bio');
    bioEl.textContent = data.bio || '一位热爱编程的开发者 🌱';

    // 更新页面标题
    document.title = `${data.login} - Personal Blog`;
  } catch (err) {
    console.error('获取用户信息失败:', err);
    document.getElementById('username').textContent = GITHUB_USERNAME;
    document.getElementById('bio').textContent = '无法加载简介，请稍后刷新';
  }
}

/**
 * 获取公开仓库列表（按 Star 数排序，取前 6 个）
 */
async function fetchRepos() {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/users/${GITHUB_USERNAME}/repos?sort=stars&direction=desc&per_page=${MAX_REPOS}&type=owner`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const repos = await res.json();
    renderRepos(repos);
  } catch (err) {
    console.error('获取仓库列表失败:', err);
    const grid = document.getElementById('repos-grid');
    grid.innerHTML = `
      <div class="loading-placeholder">
        <p>⚠️ 加载仓库数据失败，请刷新重试</p>
      </div>`;
  }
}

/**
 * 渲染仓库卡片到页面
 */
function renderRepos(repos) {
  const grid = document.getElementById('repos-grid');
  grid.innerHTML = '';

  if (repos.length === 0) {
    grid.innerHTML = '<div class="loading-placeholder"><p>暂无公开仓库</p></div>';
    return;
  }

  repos.forEach((repo, index) => {
    const card = document.createElement('a');
    card.href = repo.html_url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.className = 'repo-card';
    card.dataset.index = index;

    // 语言颜色映射
    const langColor = getLanguageColor(repo.language);

    card.innerHTML = `
      <h3 class="repo-name">${escapeHtml(repo.name)}</h3>
      <p class="repo-desc">${escapeHtml(repo.description || '暂无描述')}</p>
      <div class="repo-meta">
        ${repo.language ? `
          <span class="repo-meta-item">
            <span class="lang-dot" style="background:${langColor}"></span>
            ${escapeHtml(repo.language)}
          </span>
        ` : ''}
        <span class="repo-meta-item">⭐ ${repo.stargazers_count}</span>
        <span class="repo-meta-item">🔀 ${repo.forks_count}</span>
      </div>
    `;

    grid.appendChild(card);
  });
}

/**
 * 编程语言到颜色的简易映射
 */
function getLanguageColor(lang) {
  const colors = {
    'JavaScript': '#F7DF1E',
    'TypeScript': '#3178C6',
    'Python': '#3776AB',
    'Java': '#B07219',
    'C++': '#F34B7D',
    'C#': '#239120',
    'C': '#555555',
    'Go': '#00ADD8',
    'Rust': '#DEA584',
    'Ruby': '#CC342D',
    'PHP': '#4F5D95',
    'Swift': '#FA7343',
    'Kotlin': '#A97BFF',
    'Vue': '#4FC08D',
    'HTML': '#E34C26',
    'CSS': '#563D7C',
    'Shell': '#89E051',
    'Dart': '#00B4AB',
  };
  return colors[lang] || '#7E8590';
}

/**
 * HTML 转义（防 XSS）
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   2. 隐藏触发器机制
   ============================================================ */

/**
 * 触发器 A：3 秒内快速点击标题 6 次
 * 使用滑动窗口算法：记录最近 6 次点击的时间戳
 */
const CLICK_THRESHOLD = 6;       // 需要点击次数
const CLICK_WINDOW_MS = 3000;    // 时间窗口（毫秒）
let clickTimestamps = [];

function initTitleClickTrigger() {
  const titleEl = document.getElementById('username');
  titleEl.addEventListener('click', () => {
    const now = Date.now();
    clickTimestamps.push(now);

    // 只保留时间窗口内的记录
    clickTimestamps = clickTimestamps.filter(t => now - t <= CLICK_WINDOW_MS);

    if (clickTimestamps.length >= CLICK_THRESHOLD) {
      clickTimestamps = [];
      requestModeSwitch();
    }
  });
}

/**
 * 触发器 B：页脚隐藏像素点单击
 */
function initSecretPixelTrigger() {
  const pixel = document.getElementById('secret-pixel');
  pixel.addEventListener('click', (e) => {
    e.preventDefault();
    requestModeSwitch();
  });
}

/* ============================================================
   3. 模式切换请求与光敏警告
   ============================================================ */

/**
 * 请求切换模式：如果是切换到恐怖模式，先弹出光敏警告
 */
function requestModeSwitch() {
  if (isHorrorMode) {
    // 从恐怖模式切回治愈模式，无需警告
    switchToHealingMode();
    return;
  }

  // 直接触发 Glitch 过渡动画
  triggerGlitchTransition();
}



/* ============================================================
   4. Glitch 过渡动画
   [EPILEPSY-RISK] 包含快速闪烁和颜色反转
   ============================================================ */

/**
 * 触发 Glitch 过渡动画（1.5 秒），动画结束后切入恐怖模式
 */
function triggerGlitchTransition() {
  const overlay = document.getElementById('glitch-overlay');
  const canvas = document.getElementById('glitch-canvas');
  const ctx = canvas.getContext('2d');

  // 设置 Canvas 尺寸
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // 激活覆盖层
  overlay.classList.add('active');

  // 在 Canvas 上绘制噪点 + 撕裂效果
  let glitchFrame = 0;
  const glitchDuration = 1500; // 1.5 秒
  const startTime = performance.now();

  function drawGlitchFrame(timestamp) {
    const elapsed = timestamp - startTime;
    if (elapsed >= glitchDuration) {
      // 动画结束，切入恐怖模式
      overlay.classList.remove('active');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      switchToHorrorMode();
      return;
    }

    const progress = elapsed / glitchDuration;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // === [EPILEPSY-RISK] 噪点绘制 ===
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 255;
      const intensity = Math.random() > 0.5 + progress * 0.3 ? 1 : 0;
      data[i] = noise * intensity;                          // R
      data[i + 1] = (Math.random() > 0.7 ? 255 : 0) * intensity; // G
      data[i + 2] = (Math.random() > 0.8 ? noise : 0) * intensity; // B
      data[i + 3] = Math.floor(180 * (1 - progress * 0.3));    // A
    }
    ctx.putImageData(imageData, 0, 0);

    // === 水平撕裂条 ===
    const tearCount = Math.floor(3 + progress * 12);
    for (let i = 0; i < tearCount; i++) {
      const y = Math.random() * canvas.height;
      const h = 1 + Math.random() * (5 + progress * 15);
      const offset = (Math.random() - 0.5) * (40 + progress * 80);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y, canvas.width, h);
      ctx.clip();
      ctx.translate(offset, 0);
      // 绘制颜色偏移通道
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 139}, 0, ${Math.random() > 0.5 ? 51 : 0}, 0.4)`;
      ctx.fillRect(0, y, canvas.width, h);
      ctx.restore();
    }

    // === 大块色彩通道分离 ===
    if (Math.random() > 0.6) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 0, 51, ${0.1 + Math.random() * 0.2})`;
      ctx.fillRect(
        (Math.random() - 0.5) * 30,
        0,
        canvas.width,
        canvas.height
      );
      ctx.fillStyle = `rgba(0, 255, 65, ${0.1 + Math.random() * 0.15})`;
      ctx.fillRect(
        (Math.random() - 0.5) * 30,
        0,
        canvas.width,
        canvas.height
      );
      ctx.globalCompositeOperation = 'source-over';
    }

    glitchFrame++;
    requestAnimationFrame(drawGlitchFrame);
  }

  requestAnimationFrame(drawGlitchFrame);
}

/* ============================================================
   5. 恐怖模式激活
   ============================================================ */

/**
 * 切换到恐怖模式：添加 CSS 类 + 启动所有恐怖效果
 */
function switchToHorrorMode() {
  isHorrorMode = true;
  document.body.classList.add('horror-mode');

  // 更改标题图标
  document.getElementById('repos-title-text').textContent = '// 被遗忘的项目';

  // 启动背景噪点动画
  startNoiseAnimation();

  // 启动恐怖交互效果
  startCursorTrails();
  startRandomFlickers();

  // 启动音效（需要用户交互后才能播放）
  startHorrorAudio();
}

/**
 * 切回治愈模式：移除所有恐怖效果
 */
function switchToHealingMode() {
  isHorrorMode = false;
  document.body.classList.remove('horror-mode');

  // 恢复标题
  document.getElementById('repos-title-text').textContent = '开源项目';

  // 停止所有恐怖效果
  stopNoiseAnimation();
  stopCursorTrails();
  stopRandomFlickers();
  stopHorrorAudio();
}

/* ============================================================
   6. 背景噪点动画（恐怖模式）
   模拟旧电视雪花噪点
   ============================================================ */

function startNoiseAnimation() {
  const canvas = document.getElementById('noise-canvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function drawNoise() {
    if (!isHorrorMode) return;

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    // 低分辨率噪点以提升性能：每 3x3 像素块使用相同值
    const blockSize = 3;
    for (let y = 0; y < canvas.height; y += blockSize) {
      for (let x = 0; x < canvas.width; x += blockSize) {
        const value = Math.random() * 255;
        for (let dy = 0; dy < blockSize && y + dy < canvas.height; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < canvas.width; dx++) {
            const index = ((y + dy) * canvas.width + (x + dx)) * 4;
            data[index] = value;
            data[index + 1] = value * 0.8;
            data[index + 2] = value * 0.6;
            data[index + 3] = 40;
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    noiseAnimFrameId = requestAnimationFrame(drawNoise);
  }

  drawNoise();
}

function stopNoiseAnimation() {
  if (noiseAnimFrameId) {
    cancelAnimationFrame(noiseAnimFrameId);
    noiseAnimFrameId = null;
  }
  const canvas = document.getElementById('noise-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/* ============================================================
   7. 光标残留效果（恐怖模式）
   鼠标移动时产生滞后的粘稠视觉残留
   ============================================================ */

function startCursorTrails() {
  cursorTrailsEnabled = true;
  const container = document.getElementById('cursor-trails');

  let trailCount = 0;
  const MAX_TRAILS = 30; // 限制最大残影数量以维持性能

  function onMouseMove(e) {
    if (!cursorTrailsEnabled || !isHorrorMode) return;

    // 节流：每 3 个事件生成 1 个残影
    trailCount++;
    if (trailCount % 3 !== 0) return;

    const trail = document.createElement('div');
    trail.className = 'cursor-trail';
    trail.style.left = e.clientX + 'px';
    trail.style.top = e.clientY + 'px';
    container.appendChild(trail);

    // 动画结束后移除
    trail.addEventListener('animationend', () => {
      trail.remove();
    });

    // 安全上限：超过最大数量时移除最早的
    while (container.children.length > MAX_TRAILS) {
      container.firstChild.remove();
    }
  }

  document.addEventListener('mousemove', onMouseMove);

  // 存储引用以便后续清理
  startCursorTrails._handler = onMouseMove;
}

function stopCursorTrails() {
  cursorTrailsEnabled = false;
  if (startCursorTrails._handler) {
    document.removeEventListener('mousemove', startCursorTrails._handler);
    startCursorTrails._handler = null;
  }
  const container = document.getElementById('cursor-trails');
  container.innerHTML = '';
}

/* ============================================================
   8. 随机恐怖事件（闪烁、黑屏、抖动）
   [EPILEPSY-RISK] 包含屏幕闪烁和黑屏效果
   ============================================================ */

function startRandomFlickers() {
  // 事件 A：随机卡片闪烁消失（每 3-8 秒）
  const flickerInterval = setInterval(() => {
    if (!isHorrorMode) return;

    const cards = document.querySelectorAll('.repo-card');
    if (cards.length === 0) return;

    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    randomCard.classList.add('card-flicker');
    setTimeout(() => randomCard.classList.remove('card-flicker'), 300);
  }, 3000 + Math.random() * 5000);

  // [EPILEPSY-RISK] 事件 B：瞬间黑屏 jump scare（每 8-15 秒）
  const blackoutInterval = setInterval(() => {
    if (!isHorrorMode) return;

    const blackout = document.createElement('div');
    blackout.className = 'blackout';
    document.body.appendChild(blackout);
    setTimeout(() => blackout.remove(), 100);
  }, 8000 + Math.random() * 7000);

  // 事件 C：屏幕微震（每 5-10 秒）
  const shakeInterval = setInterval(() => {
    if (!isHorrorMode) return;

    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 150);
  }, 5000 + Math.random() * 5000);

  horrorIntervalIds.push(flickerInterval, blackoutInterval, shakeInterval);
}

function stopRandomFlickers() {
  horrorIntervalIds.forEach(id => clearInterval(id));
  horrorIntervalIds = [];
  document.body.classList.remove('screen-shake');
}

/* ============================================================
   9. Web Audio API 合成恐怖环境音效
   生成低频嗡鸣 + 电流噪声 + 沉重呼吸声
   无需外部音频文件
   ============================================================ */

function startHorrorAudio() {
  try {
    // 创建音频上下文
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 主增益节点（总音量控制）
    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.15; // 低音量，避免吓人过度
    masterGain.connect(audioContext.destination);
    audioNodes.push(masterGain);

    // === 低频嗡鸣（Drone）===
    // 使用两个失谐的正弦波叠加产生拍频效果
    const drone1 = audioContext.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.value = 55; // A1 基频
    const drone1Gain = audioContext.createGain();
    drone1Gain.gain.value = 0.3;
    drone1.connect(drone1Gain);
    drone1Gain.connect(masterGain);
    drone1.start();
    audioNodes.push(drone1, drone1Gain);

    const drone2 = audioContext.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 55.5; // 微微失谐，产生不安的拍频
    const drone2Gain = audioContext.createGain();
    drone2Gain.gain.value = 0.25;
    drone2.connect(drone2Gain);
    drone2Gain.connect(masterGain);
    drone2.start();
    audioNodes.push(drone2, drone2Gain);

    // 额外的次谐波
    const subDrone = audioContext.createOscillator();
    subDrone.type = 'triangle';
    subDrone.frequency.value = 27.5; // 低八度
    const subGain = audioContext.createGain();
    subGain.gain.value = 0.2;
    subDrone.connect(subGain);
    subGain.connect(masterGain);
    subDrone.start();
    audioNodes.push(subDrone, subGain);

    // === 电流噪声（Noise）===
    // 使用 AudioBufferSourceNode 生成白噪声，通过低通滤波器塑形
    const bufferSize = audioContext.sampleRate * 2;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // 低通滤波器：只保留低频噪声，模拟电流声
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 1;

    const noiseGain = audioContext.createGain();
    noiseGain.gain.value = 0.08;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSource.start();
    audioNodes.push(noiseSource, noiseFilter, noiseGain);

    // === 模拟呼吸声 ===
    // 使用 LFO 调制噪声的音量来模拟呼吸节奏
    const breathLFO = audioContext.createOscillator();
    breathLFO.type = 'sine';
    breathLFO.frequency.value = 0.18; // 约每 5.5 秒一个呼吸周期
    const breathLFOGain = audioContext.createGain();
    breathLFOGain.gain.value = 0.06;

    const breathNoise = audioContext.createBufferSource();
    breathNoise.buffer = noiseBuffer;
    breathNoise.loop = true;

    const breathFilter = audioContext.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = 600;
    breathFilter.Q.value = 2;

    const breathGain = audioContext.createGain();
    breathGain.gain.value = 0; // 由 LFO 调制

    breathLFO.connect(breathLFOGain);
    breathLFOGain.connect(breathGain.gain);

    breathNoise.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(masterGain);

    breathLFO.start();
    breathNoise.start();
    audioNodes.push(breathLFO, breathLFOGain, breathNoise, breathFilter, breathGain);

    // 音量淡入（2 秒）
    masterGain.gain.setValueAtTime(0, audioContext.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 2);

  } catch (err) {
    console.warn('Web Audio API 不可用或被阻止:', err);
  }
}

function stopHorrorAudio() {
  if (audioContext) {
    try {
      // 停止所有振荡器和音源
      audioNodes.forEach(node => {
        if (node.stop) {
          try { node.stop(); } catch (e) { /* 忽略已停止的节点 */ }
        }
        if (node.disconnect) {
          try { node.disconnect(); } catch (e) { /* 忽略 */ }
        }
      });
      audioContext.close();
    } catch (e) {
      console.warn('关闭音频上下文时出错:', e);
    }
    audioContext = null;
    audioNodes = [];
  }
}

/* ============================================================
   10. 初始化
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // 加载 GitHub 数据
  fetchUserProfile();
  fetchRepos();

  // 初始化触发器
  initTitleClickTrigger();
  initSecretPixelTrigger();



  console.log(
    '%c🌸 欢迎来到我的个人主页！',
    'color: #A8C686; font-size: 16px; font-weight: bold;'
  );
  console.log(
    '%c💡 提示：有些东西……并不像表面那么简单。',
    'color: #8B7E6A; font-style: italic;'
  );
});
