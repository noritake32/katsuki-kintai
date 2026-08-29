// GitHub Pages側の設定
window.KINTAI_CONFIG = {
  gasWebAppUrl: 'https://script.google.com/macros/s/AKfycbzlHgfl1ggoWCp3vXX3gtKf7aQaGAGpWycUPo1pbonWou12Ul-NuQtAtuRyBB5n79z8/exec'
};

// STEP4: 休日・シフトUI拡張を読み込む。
(function(){
  var s=document.createElement('script');
  s.src='./schedule-extension.js?v=20260829-step4';
  s.defer=true;
  document.head.appendChild(s);
})();

// =========================================================
// Login route compatibility fix
// - 管理者アカウントをスタッフ画面へ誤ルーティングしない
// - スタッフ情報の遅延応答でログイン画面へ勝手に戻さない
// =========================================================
window.addEventListener('load', function () {
  if (typeof window.routeByAccount === 'function') {
    window.routeByAccount = function (account) {
      window.currentAccount = account || null;
      if (!account) {
        if (typeof window.showLogin === 'function') window.showLogin();
        return;
      }

      if (account.type === '拠点' || account.type === '管理者') {
        if (typeof window.enterKiosk === 'function') window.enterKiosk();
        return;
      }

      if (account.type === 'スタッフ' && account.staffId) {
        if (typeof window.enterMobile === 'function') window.enterMobile(account.staffId);
        return;
      }

      if (typeof window.showLogin === 'function') window.showLogin();
      if (typeof window.showLoginError === 'function') {
        window.showLoginError('このアカウントの種別設定を確認してください。');
      }
    };
  }

  if (typeof window.enterMobile === 'function') {
    window.enterMobile = function (staffId) {
      window.appMode = 'staff';
      if (typeof window.showOnly === 'function') window.showOnly('mobilePunchView');

      var accountAtStart = window.currentAccount;
      var accountIdAtStart = accountAtStart && accountAtStart.id ? String(accountAtStart.id) : '';
      var staffIdAtStart = String(staffId || '');

      if (accountAtStart && accountAtStart.displayName) {
        window.selected = { id: staffIdAtStart, name: accountAtStart.displayName };
        if (typeof window.setText === 'function') window.setText('mpName', accountAtStart.displayName);
      }

      window.google.script.run
        .withSuccessHandler(function (d) {
          if (!window.currentAccount || String(window.currentAccount.id || '') !== accountIdAtStart) return;

          if (!d || !d.staff) {
            if (typeof window.showResultEl === 'function') {
              window.showResultEl('mobileResult', 'スタッフ情報を確認できませんでした。再読み込みしても直らない場合は管理者へ連絡してください。', false);
            }
            return;
          }

          document.title = d.companyName || document.title;
          window.selected = { id: d.staff.id, name: d.staff.name };

          if (d.photo) window.livePhotos[d.staff.id] = d.photo;
          else if (d.staff.status !== '勤務中') delete window.livePhotos[d.staff.id];

          var av = document.getElementById('mpAvatar');
          if (av) {
            av.className = 'avatar ' + (window.livePhotos[d.staff.id] ? 'av-photo' : window.avClass(d.staff.status));
            av.innerHTML = window.avatarInner(d.staff);
          }

          window.setText('mpName', d.staff.name);
          window.hide('mobileResult');
          window.renderTodayList(d.today, 'mobileTodayList');
          window.applyPunchButtonState(d.staff.id, d.today, 'mobileTodayList');
        })
        .withFailureHandler(function () {
          if (typeof window.showResultEl === 'function') {
            window.showResultEl('mobileResult', '通信が不安定です。接続が戻ると自動的に利用できます。', false);
          }
        })
        .getStaffData(staffIdAtStart);
    };
  }
});
