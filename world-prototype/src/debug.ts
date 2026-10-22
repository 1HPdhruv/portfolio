import * as THREE from 'three';
import { ZONES } from './layout';

/** Development overlay only. Not portfolio UI. */
export class Debug {
  el = Object.assign(document.createElement('div'), { id: 'dbg' });
  private stats!: HTMLDivElement;
  private frames: number[] = [];
  constructor(private api: { teleport: (id: string) => void; toggle: (k: string) => void; }) {
    document.body.appendChild(this.el);
    this.el.innerHTML = `<div><b>THE BASIN</b> · world prototype · debug</div><div id="st"></div>
      <div style="margin-top:4px">
        <button data-t="fly">F fly</button><button data-t="overview">O overview</button><button data-t="contour">C contours</button><button data-t="hide">H hide</button><button data-t="anchors">P anchors</button>
      </div><div id="zones"></div>
      <div style="margin-top:4px;color:#8e9a92">WASD drive · Shift boost · drag orbit · wheel zoom</div>`;
    this.stats = this.el.querySelector('#st')!;
    const zl = this.el.querySelector('#zones')!;
    for (const z of [...ZONES].sort((a, b) => a.num - b.num)) {
      const b = document.createElement('button'); b.textContent = `${z.num} ${z.name}`; b.onclick = () => api.teleport(z.id); zl.appendChild(b);
    }
    this.el.querySelectorAll('button[data-t]').forEach((b) => ((b as HTMLButtonElement).onclick = () => api.toggle((b as HTMLElement).dataset.t!)));
  }
  update(dt: number, r: THREE.WebGLRenderer, info: string) {
    this.frames.push(dt); if (this.frames.length > 90) this.frames.shift();
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    const i = r.info;
    this.stats.innerHTML = `${(1 / avg).toFixed(0)} fps · ${(avg * 1000).toFixed(1)} ms<br>calls ${i.render.calls} · tris ${(i.render.triangles / 1000).toFixed(0)}k<br>geo ${i.memory.geometries} · tex ${i.memory.textures}<br>${info}`;
  }
  fps() { const avg = this.frames.reduce((a, b) => a + b, 0) / Math.max(1, this.frames.length); return 1 / avg; }
}
