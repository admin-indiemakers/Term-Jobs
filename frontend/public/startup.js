      (function() {
        try {
          var publicJobRoutes = ['/', '/open-roles', '/openroles', '/jobs', '/careers', '/apply'];
          var isPublicJobPage = publicJobRoutes.indexOf(location.pathname) !== -1;
          var hasSession = !!localStorage.getItem('token') || !!localStorage.getItem('auth_token') || !!localStorage.getItem('auth_user');
          if (!isPublicJobPage || hasSession) return;
          var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
          var base = isLocal ? 'http://' + location.hostname + ':8000' : '';
          var url = base + '/api/public/requisitions/page?page=1&page_size=16';
          window.__PREFETCHED_REQUISITIONS__ = fetch(url, { cache: 'no-store', headers: { 'Accept': 'application/json' } })
            .then(function(r) { return r.ok ? r.json() : null; })
            .catch(function() { return null; });

        } catch(e) {}
      })();

// Activate the deferred font stylesheet without an inline event handler.
document.addEventListener("load", function (event) {
  if (event.target.matches?.("link[data-deferred-fonts]")) {
    event.target.media = "all";
  }
}, true);
