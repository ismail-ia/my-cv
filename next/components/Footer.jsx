import { profile } from '@/lib/profile';

export default function Footer() {
  return (
    <footer className="on-dark foot">
      <div className="shell foot__in">
        <a className="lockup" href="#top">
          <img src="/assets/logo/mark-inverse.svg" alt="" width="26" height="26" />
          <span>{profile.name}</span>
        </a>
        <p>&copy; <span className="num">2026</span> &middot; Built in Laravel country, shipped as static HTML</p>
      </div>
    </footer>
  );
}
