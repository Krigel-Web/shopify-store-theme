(() => {
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const storageKey = (handle) => `bhm-reader-progress:${handle}`;
  const DESKTOP_SPREAD_MEDIA = '(min-width: 992px)';
  const SCROLL_OFFSET = 24;
  const DESKTOP_STAGE_OFFSET = 24;
  const DESKTOP_ZOOM_MIN = 1;
  const DESKTOP_ZOOM_MAX = 2.2;
  const DESKTOP_ZOOM_STEP = 0.2;
  const DESKTOP_VIEW_MODE_SPREAD = 'spread';
  const DESKTOP_VIEW_MODE_SINGLE = 'single';
  const DESKTOP_VIEW_MODE_GRID = 'grid';

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function getManifest(manifestId) {
    const el = document.getElementById(manifestId);
    return el ? safeJsonParse(el.textContent) : null;
  }

  function saveProgress(handle, pageIndex, progress) {
    try {
      localStorage.setItem(
        storageKey(handle),
        JSON.stringify({
          pageIndex,
          progress,
          updatedAt: Date.now()
        })
      );
    } catch (_) {}
  }

  function getSavedProgress(handle) {
    try {
      return safeJsonParse(localStorage.getItem(storageKey(handle)));
    } catch (_) {
      return null;
    }
  }

  function clearSavedProgress(handle) {
    try {
      localStorage.removeItem(storageKey(handle));
    } catch (_) {}
  }

  function createPage(url, index, title) {
    const page = document.createElement('article');
    page.className = 'reader-page';
    page.dataset.pageIndex = String(index);

    const img = document.createElement('img');
    img.alt = `${title} page ${index + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = url;

    page.appendChild(img);
    return page;
  }

  function createSpread(spreadIndex, spreadPages) {
    const spread = document.createElement('section');
    spread.className = 'reader-spread';
    spread.dataset.spreadIndex = String(spreadIndex);
    spread.dataset.startPageIndex = spreadPages[0]?.dataset.pageIndex || '0';

    if (spreadPages.length === 1) {
      spread.classList.add('reader-spread--single');
    }

    spreadPages.forEach((page) => {
      spread.appendChild(page);
    });

    return spread;
  }

  function createGridItem(url, index, title) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'reader-grid__item';
    item.dataset.pageIndex = String(index);
    item.setAttribute('aria-label', `Open page ${index + 1}`);

    const thumb = document.createElement('div');
    thumb.className = 'reader-grid__thumb';

    const img = document.createElement('img');
    img.alt = `${title} page ${index + 1} thumbnail`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = url;

    const meta = document.createElement('div');
    meta.className = 'reader-grid__meta';

    const number = document.createElement('span');
    number.className = 'reader-grid__page-number';
    number.textContent = `Page ${index + 1}`;

    thumb.appendChild(img);
    meta.appendChild(number);
    item.appendChild(thumb);
    item.appendChild(meta);

    return item;
  }

  function getCurrentScrollPosition(pages) {
    const probeY = window.innerHeight * 0.18;
    let bestIndex = 0;
    let bestScore = Infinity;

    pages.forEach((page, index) => {
      const rect = page.getBoundingClientRect();
      const score = Math.abs(rect.top - probeY);

      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const currentPage = pages[bestIndex];
    const rect = currentPage.getBoundingClientRect();
    const progress = clamp((probeY - rect.top) / Math.max(rect.height, 1), 0, 1);

    return { pageIndex: bestIndex, progress };
  }

  function waitForImage(img) {
    if (!img) return Promise.resolve();

    if (img.loading === 'lazy') {
      img.loading = 'eager';
    }

    if ('fetchPriority' in img) {
      img.fetchPriority = 'high';
    }

    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === 'function') {
        return img.decode().catch(() => {});
      }
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const done = async () => {
        if (typeof img.decode === 'function') {
          try {
            await img.decode();
          } catch (_) {}
        }
        resolve();
      };

      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });

      if (img.src) {
        img.src = img.src;
      }
    });
  }

  function primeSpreadImages(spread) {
    if (!spread) return [];

    const images = Array.from(spread.querySelectorAll('img'));
    images.forEach((img) => {
      img.loading = 'eager';
      if ('fetchPriority' in img) {
        img.fetchPriority = 'high';
      }
      if (img.src) {
        img.src = img.src;
      }
    });

    return images;
  }

  async function restoreScrollProgress(manifest, pages) {
    const saved = getSavedProgress(manifest.handle);
    if (!saved || typeof saved.pageIndex !== 'number') return false;

    const safeIndex = clamp(saved.pageIndex, 0, pages.length - 1);
    const targetPage = pages[safeIndex];
    if (!targetPage) return false;

    const targetImg = targetPage.querySelector('img');
    await waitForImage(targetImg);

    const top =
      targetPage.offsetTop +
      targetPage.offsetHeight * clamp(saved.progress || 0, 0, 1) -
      SCROLL_OFFSET;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'auto'
    });

    return true;
  }

  function getBackHref() {
    try {
      if (!document.referrer) return '/collections/all';

      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin) {
        return `${ref.pathname}${ref.search}${ref.hash}`;
      }
    } catch (_) {}

    return '/collections/all';
  }

  function getStatusText(pageIndex, totalPages, isDesktopSpread, desktopViewMode) {
    const currentPage = clamp(pageIndex + 1, 1, totalPages);

    if (isDesktopSpread && desktopViewMode === DESKTOP_VIEW_MODE_GRID) {
      return `Grid · ${totalPages} pages`;
    }

    if (!isDesktopSpread || desktopViewMode === DESKTOP_VIEW_MODE_SINGLE) {
      return `Page ${currentPage} of ${totalPages}`;
    }

    const spreadStart = pageIndex % 2 === 0 ? currentPage : currentPage - 1;
    const spreadEnd = Math.min(spreadStart + 1, totalPages);

    if (spreadStart === spreadEnd) {
      return `Page ${spreadStart} of ${totalPages}`;
    }

    return `Pages ${spreadStart}–${spreadEnd} of ${totalPages}`;
  }

  function getScrollProgressPercent() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (maxScroll <= 1) {
      return 0;
    }

    return clamp((window.scrollY / maxScroll) * 100, 0, 100);
  }

  function getDesktopProgressPercent(pageIndex, totalPages) {
    if (totalPages <= 1) {
      return 0;
    }

    return clamp((pageIndex / (totalPages - 1)) * 100, 0, 100);
  }

  function isInteractiveElement(el) {
    if (!el || !(el instanceof Element)) return false;

    if (el.isContentEditable) return true;

    return Boolean(
      el.closest('a, button, input, textarea, select, [contenteditable="true"]')
    );
  }

  function getSpreadStartIndex(pageIndex) {
    return pageIndex % 2 === 0 ? pageIndex : Math.max(pageIndex - 1, 0);
  }

  function getSpreadIndexFromPageIndex(pageIndex) {
    return Math.floor(getSpreadStartIndex(pageIndex) / 2);
  }

  function scrollToPage(pages, pageIndex) {
    const targetPage = pages[pageIndex];
    if (!targetPage) return;

    window.scrollTo({
      top: Math.max(0, targetPage.offsetTop - SCROLL_OFFSET),
      behavior: 'auto'
    });
  }

  function createTopbar(manifest, totalPages, isDesktopSpread, desktopViewMode) {
    const topbar = document.createElement('div');
    topbar.className = 'reader-topbar';

    const left = document.createElement('div');
    left.className = 'reader-topbar__left';

    const back = document.createElement('a');
    back.className = 'reader-topbar__back';
    back.href = getBackHref();
    back.textContent = 'Back';

    const meta = document.createElement('div');
    meta.className = 'reader-topbar__meta';

    const title = document.createElement('h1');
    title.className = 'reader-topbar__title';
    title.textContent = manifest.title || 'Comic';

    const format = document.createElement('div');
    format.className = 'reader-topbar__format';
    format.textContent =
      manifest.format === 'compact' ? 'Compact comic' : 'Standard comic';

    const status = document.createElement('div');
    status.className = 'reader-topbar__status';
    status.textContent = getStatusText(0, totalPages, isDesktopSpread, desktopViewMode);

    const right = document.createElement('div');
    right.className = 'reader-topbar__right';

    const controls = document.createElement('div');
    controls.className = 'reader-topbar__controls';

    const viewToggle = document.createElement('div');
    viewToggle.className = 'reader-topbar__view-toggle';
    viewToggle.setAttribute('role', 'group');
    viewToggle.setAttribute('aria-label', 'Desktop page layout');

    const singleButton = document.createElement('button');
    singleButton.type = 'button';
    singleButton.className = 'reader-topbar__view-button';
    singleButton.setAttribute('aria-label', 'Single page mode');
    singleButton.textContent = '1P';

    const spreadButton = document.createElement('button');
    spreadButton.type = 'button';
    spreadButton.className = 'reader-topbar__view-button';
    spreadButton.setAttribute('aria-label', 'Two page spread mode');
    spreadButton.textContent = '2P';

    const gridButton = document.createElement('button');
    gridButton.type = 'button';
    gridButton.className = 'reader-topbar__view-button';
    gridButton.setAttribute('aria-label', 'Grid mode');
    gridButton.textContent = 'Grid';

    viewToggle.appendChild(singleButton);
    viewToggle.appendChild(spreadButton);
    viewToggle.appendChild(gridButton);

    const zoomOutButton = document.createElement('button');
    zoomOutButton.type = 'button';
    zoomOutButton.className = 'reader-topbar__zoom';
    zoomOutButton.setAttribute('aria-label', 'Zoom out');
    zoomOutButton.textContent = '−';

    const zoomLabel = document.createElement('div');
    zoomLabel.className = 'reader-topbar__zoom-label';
    zoomLabel.textContent = '100%';

    const zoomInButton = document.createElement('button');
    zoomInButton.type = 'button';
    zoomInButton.className = 'reader-topbar__zoom';
    zoomInButton.setAttribute('aria-label', 'Zoom in');
    zoomInButton.textContent = '+';

    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'reader-topbar__nav';
    prevButton.setAttribute('aria-label', 'Previous page');
    prevButton.textContent = '←';

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'reader-topbar__nav';
    nextButton.setAttribute('aria-label', 'Next page');
    nextButton.textContent = '→';

    controls.appendChild(viewToggle);
    controls.appendChild(zoomOutButton);
    controls.appendChild(zoomLabel);
    controls.appendChild(zoomInButton);
    controls.appendChild(prevButton);
    controls.appendChild(nextButton);

    const progress = document.createElement('div');
    progress.className = 'reader-progress';
    progress.setAttribute('aria-hidden', 'true');

    const progressFill = document.createElement('span');
    progressFill.className = 'reader-progress__fill';
    progress.appendChild(progressFill);

    meta.appendChild(title);
    meta.appendChild(format);

    left.appendChild(back);
    left.appendChild(meta);

    right.appendChild(status);
    right.appendChild(controls);

    topbar.appendChild(left);
    topbar.appendChild(right);
    topbar.appendChild(progress);

    return {
      topbar,
      status,
      prevButton,
      nextButton,
      progressFill,
      zoomOutButton,
      zoomInButton,
      zoomLabel,
      singleButton,
      spreadButton,
      gridButton
    };
  }

  function createResumePrompt() {
    const prompt = document.createElement('div');
    prompt.className = 'reader-resume';
    prompt.hidden = true;

    prompt.innerHTML = `
      <div class="reader-resume__text">
        Resume from page <span data-reader-resume-page>1</span>
      </div>
      <div class="reader-resume__actions">
        <button type="button" class="reader-resume__button reader-resume__button--primary" data-reader-resume-continue>
          Resume
        </button>
        <button type="button" class="reader-resume__button" data-reader-resume-reset>
          Start over
        </button>
      </div>
    `;

    return {
      prompt,
      page: prompt.querySelector('[data-reader-resume-page]'),
      continueButton: prompt.querySelector('[data-reader-resume-continue]'),
      resetButton: prompt.querySelector('[data-reader-resume-reset]')
    };
  }

  function initReader(app) {
    const manifestId = app.getAttribute('data-manifest-id');
    const manifest = getManifest(manifestId);

    if (!manifest || !Array.isArray(manifest.pages) || manifest.pages.length === 0) {
      app.innerHTML =
        '<div class="reader-empty"><h1>No pages found</h1><p>This reader has no pages yet.</p></div>';
      return;
    }

    const pageUrls = manifest.pages.filter(Boolean);
    const readerTitle = manifest.title || app.dataset.readerTitle || 'Comic';

    app.innerHTML = '';

    const desktopSpreadQuery = window.matchMedia(DESKTOP_SPREAD_MEDIA);
    let desktopViewMode = DESKTOP_VIEW_MODE_SPREAD;

    const {
      topbar,
      status,
      prevButton,
      nextButton,
      progressFill,
      zoomOutButton,
      zoomInButton,
      zoomLabel,
      singleButton,
      spreadButton,
      gridButton
    } = createTopbar(
      manifest,
      pageUrls.length,
      desktopSpreadQuery.matches,
      desktopViewMode
    );

    const resume = createResumePrompt();

    const stage = document.createElement('div');
    stage.className = 'reader-stage';

    const stageCanvas = document.createElement('div');
    stageCanvas.className = 'reader-stage__canvas';

    const stageGrid = document.createElement('div');
    stageGrid.className = 'reader-grid';
    stageGrid.hidden = true;

    stage.appendChild(stageCanvas);
    stage.appendChild(stageGrid);

    app.appendChild(topbar);
    app.appendChild(resume.prompt);
    app.appendChild(stage);

    const saved = getSavedProgress(manifest.handle);
    const shouldOfferResume =
      saved &&
      typeof saved.pageIndex === 'number' &&
      (saved.pageIndex > 0 || clamp(saved.progress || 0, 0, 1) > 0.02);

    if (shouldOfferResume) {
      const safeResumePage = clamp(saved.pageIndex + 1, 1, pageUrls.length);
      resume.page.textContent = String(safeResumePage);
      resume.prompt.hidden = false;
    } else {
      resume.prompt.hidden = true;
    }

    let ticking = false;
    let isRestoring = true;
    let isResumeChoicePending = Boolean(shouldOfferResume);
    let isAnimating = false;
    let activeSpreadIndex = 0;
    let activeDesktopPageIndex = 0;
    let wasDesktop = desktopSpreadQuery.matches;
    let desktopZoom = 1;

    const dismissResumePrompt = () => {
      isResumeChoicePending = false;
      resume.prompt.hidden = true;
    };

    const pages = pageUrls.map((url, index) => {
      const page = createPage(url, index, readerTitle);

      page.addEventListener('click', () => {
        if (isResumeChoicePending) {
          dismissResumePrompt();
        }
      });

      return page;
    });

    const spreads = [];

    for (let i = 0; i < pages.length; i += 2) {
      const spreadPages = pages.slice(i, i + 2);
      const spread = createSpread(spreads.length, spreadPages);
      stageCanvas.appendChild(spread);
      spreads.push(spread);
    }

    const gridItems = pageUrls.map((url, index) => {
      const item = createGridItem(url, index, readerTitle);
      stageGrid.appendChild(item);
      return item;
    });

    const applyDesktopZoom = () => {
      if (!desktopSpreadQuery.matches || desktopViewMode === DESKTOP_VIEW_MODE_GRID) {
        stage.style.setProperty('--reader-zoom', '1');
        return;
      }

      stage.style.setProperty('--reader-zoom', String(desktopZoom));
    };

    const updateZoomUI = () => {
      const isDesktopReading =
        desktopSpreadQuery.matches && desktopViewMode !== DESKTOP_VIEW_MODE_GRID;
      const zoomPercent = Math.round(desktopZoom * 100);

      zoomLabel.textContent = `${zoomPercent}%`;
      zoomOutButton.disabled = !isDesktopReading || desktopZoom <= DESKTOP_ZOOM_MIN;
      zoomInButton.disabled = !isDesktopReading || desktopZoom >= DESKTOP_ZOOM_MAX;
    };

    const updateGridUI = () => {
      const isGridMode =
        desktopSpreadQuery.matches && desktopViewMode === DESKTOP_VIEW_MODE_GRID;

      stageGrid.hidden = !isGridMode;

      gridItems.forEach((item, index) => {
        const isActive = index === activeDesktopPageIndex;
        item.classList.toggle('reader-grid__item--active', isActive);
        item.setAttribute('aria-current', isActive ? 'page' : 'false');
      });
    };

    const updateViewModeUI = () => {
      const isDesktop = desktopSpreadQuery.matches;

      singleButton.disabled = !isDesktop || desktopViewMode === DESKTOP_VIEW_MODE_SINGLE;
      spreadButton.disabled = !isDesktop || desktopViewMode === DESKTOP_VIEW_MODE_SPREAD;
      gridButton.disabled = !isDesktop || desktopViewMode === DESKTOP_VIEW_MODE_GRID;

      singleButton.setAttribute(
        'aria-pressed',
        desktopViewMode === DESKTOP_VIEW_MODE_SINGLE ? 'true' : 'false'
      );
      spreadButton.setAttribute(
        'aria-pressed',
        desktopViewMode === DESKTOP_VIEW_MODE_SPREAD ? 'true' : 'false'
      );
      gridButton.setAttribute(
        'aria-pressed',
        desktopViewMode === DESKTOP_VIEW_MODE_GRID ? 'true' : 'false'
      );

      stage.dataset.desktopMode = desktopViewMode;
      updateGridUI();
    };

    const setDesktopZoom = (nextZoom) => {
      if (!desktopSpreadQuery.matches) return;
      if (desktopViewMode === DESKTOP_VIEW_MODE_GRID) return;

      const previousZoom = desktopZoom;
      const viewportWidth = stage.clientWidth;
      const viewportHeight = stage.clientHeight;
      const centerX = stage.scrollLeft + viewportWidth / 2;
      const centerY = stage.scrollTop + viewportHeight / 2;

      desktopZoom = clamp(
        Math.round(nextZoom * 100) / 100,
        DESKTOP_ZOOM_MIN,
        DESKTOP_ZOOM_MAX
      );

      applyDesktopZoom();
      updateZoomUI();

      const ratio = desktopZoom / previousZoom;

      requestAnimationFrame(() => {
        stage.scrollLeft = Math.max(0, centerX * ratio - viewportWidth / 2);
        stage.scrollTop = Math.max(0, centerY * ratio - viewportHeight / 2);
      });
    };

    const resetDesktopZoom = () => {
      desktopZoom = 1;
      applyDesktopZoom();
      updateZoomUI();

      if (desktopSpreadQuery.matches) {
        stage.scrollLeft = 0;
        stage.scrollTop = 0;
      }
    };

    const setSpreadState = (activeIndex) => {
      const isGridMode =
        desktopSpreadQuery.matches && desktopViewMode === DESKTOP_VIEW_MODE_GRID;

      spreads.forEach((spread, index) => {
        const isActive = !isGridMode && index === activeIndex;
        spread.classList.toggle('reader-spread--active', isActive);
        spread.hidden = !isActive;
        spread.classList.remove('reader-spread--desktop-single');

        const spreadPages = Array.from(spread.querySelectorAll('.reader-page'));
        spreadPages.forEach((page) => {
          page.classList.remove('reader-page--desktop-hidden');
        });

        if (
          isActive &&
          desktopSpreadQuery.matches &&
          desktopViewMode === DESKTOP_VIEW_MODE_SINGLE
        ) {
          const spreadStartIndex = clamp(
            Number(spread.dataset.startPageIndex || 0),
            0,
            pageUrls.length - 1
          );
          const visibleOffset = clamp(
            activeDesktopPageIndex - spreadStartIndex,
            0,
            Math.max(spreadPages.length - 1, 0)
          );

          spread.classList.add('reader-spread--desktop-single');

          spreadPages.forEach((page, pageOffset) => {
            if (pageOffset !== visibleOffset) {
              page.classList.add('reader-page--desktop-hidden');
            }
          });
        }

        spread.style.opacity = '';
        spread.style.transform = '';
        spread.style.zIndex = '';
      });

      applyDesktopZoom();
      updateViewModeUI();
    };

    const getActiveDesktopPageIndex = () => {
      return clamp(activeDesktopPageIndex, 0, pageUrls.length - 1);
    };

    const getCurrentPosition = () => {
      if (desktopSpreadQuery.matches) {
        return {
          pageIndex: getActiveDesktopPageIndex(),
          progress: 0
        };
      }

      return getCurrentScrollPosition(pages);
    };

    const setDesktopNavState = () => {
      const isDesktop = desktopSpreadQuery.matches;
      let canPrev = false;
      let canNext = false;

      if (isDesktop && !isAnimating && desktopViewMode !== DESKTOP_VIEW_MODE_GRID) {
        if (desktopViewMode === DESKTOP_VIEW_MODE_SINGLE) {
          canPrev = activeDesktopPageIndex > 0;
          canNext = activeDesktopPageIndex < pageUrls.length - 1;
        } else {
          canPrev = activeSpreadIndex > 0;
          canNext = activeSpreadIndex < spreads.length - 1;
        }
      }

      prevButton.disabled = !canPrev;
      nextButton.disabled = !canNext;
    };

    const update = ({ save = true } = {}) => {
      const { pageIndex, progress } = getCurrentPosition();
      const isDesktop = desktopSpreadQuery.matches;

      status.textContent = getStatusText(
        pageIndex,
        pageUrls.length,
        isDesktop,
        desktopViewMode
      );

      progressFill.style.width = `${
        isDesktop
          ? getDesktopProgressPercent(pageIndex, pageUrls.length)
          : getScrollProgressPercent()
      }%`;

      setDesktopNavState();
      updateZoomUI();
      updateViewModeUI();

      if (save && !isRestoring && !isResumeChoicePending) {
        saveProgress(manifest.handle, pageIndex, progress);
      }
    };

    const showDesktopSpread = async (
      nextSpreadIndex,
      { save = true, targetPageIndex = null } = {}
    ) => {
      if (!spreads.length || isAnimating) return false;

      const safeIndex = clamp(nextSpreadIndex, 0, spreads.length - 1);
      const nextSpread = spreads[safeIndex];
      if (!nextSpread) return false;

      isAnimating = true;
      setDesktopNavState();

      if (desktopViewMode !== DESKTOP_VIEW_MODE_GRID) {
        primeSpreadImages(nextSpread);
      }

      const spreadPages = Array.from(nextSpread.querySelectorAll('.reader-page'));
      const spreadStartIndex = clamp(
        Number(nextSpread.dataset.startPageIndex || 0),
        0,
        pageUrls.length - 1
      );
      const spreadEndIndex = clamp(
        spreadStartIndex + spreadPages.length - 1,
        spreadStartIndex,
        pageUrls.length - 1
      );

      activeSpreadIndex = safeIndex;

      if (typeof targetPageIndex === 'number') {
        activeDesktopPageIndex = clamp(targetPageIndex, spreadStartIndex, spreadEndIndex);
      } else if (desktopViewMode === DESKTOP_VIEW_MODE_SINGLE) {
        activeDesktopPageIndex = clamp(
          activeDesktopPageIndex,
          spreadStartIndex,
          spreadEndIndex
        );
      } else if (desktopViewMode === DESKTOP_VIEW_MODE_SPREAD) {
        activeDesktopPageIndex = spreadStartIndex;
      }

      setSpreadState(safeIndex);

      if (desktopViewMode !== DESKTOP_VIEW_MODE_GRID) {
        primeSpreadImages(spreads[safeIndex + 1]);
        primeSpreadImages(spreads[safeIndex - 1]);
      }

      isAnimating = false;
      update({ save });
      return true;
    };

    const syncDesktopMode = async ({ preservePosition = true } = {}) => {
      const isDesktop = desktopSpreadQuery.matches;
      const referencePageIndex = wasDesktop
        ? getActiveDesktopPageIndex()
        : preservePosition
          ? getCurrentScrollPosition(pages).pageIndex
          : 0;

      stage.classList.toggle(
        'reader-stage--desktop-paged',
        isDesktop && desktopViewMode !== DESKTOP_VIEW_MODE_GRID
      );
      stage.classList.toggle(
        'reader-stage--desktop-grid',
        isDesktop && desktopViewMode === DESKTOP_VIEW_MODE_GRID
      );

      if (isDesktop) {
        applyDesktopZoom();

        await showDesktopSpread(getSpreadIndexFromPageIndex(referencePageIndex), {
          save: false,
          targetPageIndex: referencePageIndex
        });

        window.scrollTo({
          top: Math.max(0, app.offsetTop - DESKTOP_STAGE_OFFSET),
          behavior: 'auto'
        });

        stage.scrollLeft = 0;
        stage.scrollTop = 0;
      } else {
        resetDesktopZoom();

        spreads.forEach((spread) => {
          spread.hidden = false;
          spread.classList.remove('reader-spread--active');
          spread.classList.remove('reader-spread--desktop-single');
          spread.style.opacity = '';
          spread.style.transform = '';
          spread.style.zIndex = '';

          Array.from(spread.querySelectorAll('.reader-page')).forEach((page) => {
            page.classList.remove('reader-page--desktop-hidden');
          });
        });

        stageGrid.hidden = true;
        stage.style.setProperty('--reader-zoom', '1');

        requestAnimationFrame(() => {
          scrollToPage(pages, clamp(referencePageIndex, 0, pages.length - 1));
          update({ save: false });
        });
      }

      wasDesktop = isDesktop;
      setDesktopNavState();
      updateZoomUI();
      updateViewModeUI();
    };

    const setDesktopViewMode = async (nextMode) => {
      if (!desktopSpreadQuery.matches) return;
      if (
        nextMode !== DESKTOP_VIEW_MODE_SINGLE &&
        nextMode !== DESKTOP_VIEW_MODE_SPREAD &&
        nextMode !== DESKTOP_VIEW_MODE_GRID
      ) {
        return;
      }
      if (desktopViewMode === nextMode) return;

      const referencePageIndex = getActiveDesktopPageIndex();

      isRestoring = true;
      desktopViewMode = nextMode;

      stage.classList.toggle(
        'reader-stage--desktop-paged',
        desktopViewMode !== DESKTOP_VIEW_MODE_GRID
      );
      stage.classList.toggle(
        'reader-stage--desktop-grid',
        desktopViewMode === DESKTOP_VIEW_MODE_GRID
      );

      if (desktopViewMode === DESKTOP_VIEW_MODE_GRID) {
        resetDesktopZoom();
      }

      await showDesktopSpread(getSpreadIndexFromPageIndex(referencePageIndex), {
        save: false,
        targetPageIndex: referencePageIndex
      });

      requestAnimationFrame(() => {
        update({ save: false });
        isRestoring = false;
      });
    };

    const openGridPage = async (pageIndex) => {
      if (!desktopSpreadQuery.matches) return;

      if (isResumeChoicePending) {
        dismissResumePrompt();
      }

      isRestoring = true;
      activeDesktopPageIndex = clamp(pageIndex, 0, pageUrls.length - 1);
      desktopViewMode = DESKTOP_VIEW_MODE_SINGLE;

      stage.classList.add('reader-stage--desktop-paged');
      stage.classList.remove('reader-stage--desktop-grid');

      await showDesktopSpread(getSpreadIndexFromPageIndex(activeDesktopPageIndex), {
        save: false,
        targetPageIndex: activeDesktopPageIndex
      });

      requestAnimationFrame(() => {
        update({ save: true });
        isRestoring = false;
      });
    };

    const performDesktopJump = async (direction) => {
      if (!desktopSpreadQuery.matches || isAnimating) return false;
      if (desktopViewMode === DESKTOP_VIEW_MODE_GRID) return false;

      if (isResumeChoicePending) {
        dismissResumePrompt();
      }

      if (desktopViewMode === DESKTOP_VIEW_MODE_SINGLE) {
        const nextPageIndex = clamp(
          activeDesktopPageIndex + direction,
          0,
          pageUrls.length - 1
        );

        if (nextPageIndex === activeDesktopPageIndex) return false;

        await showDesktopSpread(getSpreadIndexFromPageIndex(nextPageIndex), {
          save: true,
          targetPageIndex: nextPageIndex
        });

        return true;
      }

      const nextSpreadIndex = clamp(activeSpreadIndex + direction, 0, spreads.length - 1);
      if (nextSpreadIndex === activeSpreadIndex) return false;

      const nextSpread = spreads[nextSpreadIndex];
      const nextPageIndex = clamp(
        Number(nextSpread?.dataset.startPageIndex || 0),
        0,
        pageUrls.length - 1
      );

      await showDesktopSpread(nextSpreadIndex, {
        save: true,
        targetPageIndex: nextPageIndex
      });

      return true;
    };

    if (desktopSpreadQuery.matches) {
      stage.classList.add('reader-stage--desktop-paged');
      stage.style.setProperty('--reader-zoom', '1');
      setSpreadState(0);
      primeSpreadImages(spreads[0]);
      primeSpreadImages(spreads[1]);
    }

    const onScroll = () => {
      if (desktopSpreadQuery.matches) return;
      if (ticking || isRestoring) return;

      if (isResumeChoicePending && window.scrollY > 24) {
        dismissResumePrompt();
      }

      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };

    const onKeydown = (event) => {
      if (!desktopSpreadQuery.matches) return;
      if (desktopViewMode === DESKTOP_VIEW_MODE_GRID) return;
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      if (isInteractiveElement(event.target) || isInteractiveElement(document.activeElement)) return;

      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      performDesktopJump(direction);
    };

    const onStageClick = (event) => {
      if (!desktopSpreadQuery.matches) return;
      if (desktopViewMode === DESKTOP_VIEW_MODE_GRID) return;
      if (event.defaultPrevented) return;
      if (isInteractiveElement(event.target)) return;
      if (isAnimating) return;

      const rect = stage.getBoundingClientRect();
      if (!rect.width) return;

      const clickX = event.clientX - rect.left;
      const direction = clickX < rect.width / 2 ? -1 : 1;

      performDesktopJump(direction);
    };

    gridItems.forEach((item) => {
      item.addEventListener('click', () => {
        const pageIndex = Number(item.dataset.pageIndex || 0);
        openGridPage(pageIndex);
      });
    });

    resume.continueButton.addEventListener('click', async () => {
      dismissResumePrompt();
      isRestoring = true;

      if (desktopSpreadQuery.matches) {
        const savedProgress = getSavedProgress(manifest.handle);
        const pageIndex = clamp(savedProgress?.pageIndex || 0, 0, pages.length - 1);

        await showDesktopSpread(getSpreadIndexFromPageIndex(pageIndex), {
          save: false,
          targetPageIndex: pageIndex
        });

        window.scrollTo({
          top: Math.max(0, app.offsetTop - DESKTOP_STAGE_OFFSET),
          behavior: 'auto'
        });

        stage.scrollLeft = 0;
        stage.scrollTop = 0;
      } else {
        await restoreScrollProgress(manifest, pages);
      }

      requestAnimationFrame(() => {
        update({ save: false });
        isRestoring = false;
      });
    });

    resume.resetButton.addEventListener('click', async () => {
      dismissResumePrompt();
      clearSavedProgress(manifest.handle);
      isRestoring = true;

      if (desktopSpreadQuery.matches) {
        resetDesktopZoom();

        activeDesktopPageIndex = 0;
        desktopViewMode = DESKTOP_VIEW_MODE_SPREAD;

        stage.classList.add('reader-stage--desktop-paged');
        stage.classList.remove('reader-stage--desktop-grid');

        await showDesktopSpread(0, {
          save: false,
          targetPageIndex: 0
        });

        window.scrollTo({
          top: Math.max(0, app.offsetTop - DESKTOP_STAGE_OFFSET),
          behavior: 'auto'
        });

        stage.scrollLeft = 0;
        stage.scrollTop = 0;
      } else {
        window.scrollTo({
          top: 0,
          behavior: 'auto'
        });
      }

      requestAnimationFrame(() => {
        update({ save: false });
        isRestoring = false;
      });
    });

    setTimeout(async () => {
      if (desktopSpreadQuery.matches) {
        if (shouldOfferResume) {
          await showDesktopSpread(0, {
            save: false,
            targetPageIndex: 0
          });
        } else {
          const savedProgress = getSavedProgress(manifest.handle);
          const pageIndex = clamp(savedProgress?.pageIndex || 0, 0, pages.length - 1);

          await showDesktopSpread(getSpreadIndexFromPageIndex(pageIndex), {
            save: false,
            targetPageIndex: pageIndex
          });
        }

        window.scrollTo({
          top: Math.max(0, app.offsetTop - DESKTOP_STAGE_OFFSET),
          behavior: 'auto'
        });

        stage.scrollLeft = 0;
        stage.scrollTop = 0;
      } else if (shouldOfferResume) {
        update({ save: false });
      } else {
        await restoreScrollProgress(manifest, pages);
      }

      requestAnimationFrame(() => {
        update({ save: false });
        isRestoring = false;
      });
    }, 0);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('keydown', onKeydown);
    stage.addEventListener('click', onStageClick);

    prevButton.addEventListener('click', () => {
      performDesktopJump(-1);
    });

    nextButton.addEventListener('click', () => {
      performDesktopJump(1);
    });

    zoomOutButton.addEventListener('click', () => {
      if (!desktopSpreadQuery.matches) return;
      setDesktopZoom(desktopZoom - DESKTOP_ZOOM_STEP);
    });

    zoomInButton.addEventListener('click', () => {
      if (!desktopSpreadQuery.matches) return;
      setDesktopZoom(desktopZoom + DESKTOP_ZOOM_STEP);
    });

    singleButton.addEventListener('click', () => {
      setDesktopViewMode(DESKTOP_VIEW_MODE_SINGLE);
    });

    spreadButton.addEventListener('click', () => {
      setDesktopViewMode(DESKTOP_VIEW_MODE_SPREAD);
    });

    gridButton.addEventListener('click', () => {
      setDesktopViewMode(DESKTOP_VIEW_MODE_GRID);
    });

    const onDesktopModeChange = async () => {
      isRestoring = true;
      await syncDesktopMode();

      requestAnimationFrame(() => {
        update({ save: false });
        isRestoring = false;
      });
    };

    if (desktopSpreadQuery.addEventListener) {
      desktopSpreadQuery.addEventListener('change', onDesktopModeChange);
    } else if (desktopSpreadQuery.addListener) {
      desktopSpreadQuery.addListener(onDesktopModeChange);
    }

    update({ save: false });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.reader-app[data-manifest-id]').forEach(initReader);
  });
})();