export function Scenery() {
  return (
    <>
      <div className="clouds" aria-hidden="true">
        <div className="cloud cloud--1">☁️</div>
        <div className="cloud cloud--2">☁️</div>
        <div className="cloud cloud--3">☁️</div>
        <div className="cloud cloud--4">☁️</div>
      </div>
      <div className="trees" aria-hidden="true">
        <div className="tree">
          <pre className="canopy breeze-1">{`   cce*88oo
  C8O8*8Q8P*Ob o8oo
dOB*9*O8P*UOpugO9*D
CO*9O0*89PBCOPL*SOBB*
 Cgg*bU8*UO*OOd*UOdcb
   6O*U  /p  gc*U*dpP
     \\//  /d*uUP*
       \\////`}</pre>
          <pre className="trunk">{`        |||||
        |||||
  .....//||||\\....\\../\\//.....`}</pre>
        </div>
        <div className="tree">
          <pre className="canopy breeze-2">{`    cce*88oo
   C8O8*8Q8P*Ob o8oo
 dOB*9*O8P*UOpugO9*D
CO*9O0*89PBCOPL*SOBB*
 Cgg*bU8*UO*OOd*UOdcb
    6O*U  /p  gc*U*dpP
      \\//  /d*uUP*
        \\////`}</pre>
          <pre className="trunk">{`         |||||
         |||||
  ....//||||\\....\\../\\//.....`}</pre>
        </div>
        <div className="tree">
          <pre className="canopy breeze-3">{`     cce*88oo
    C8O8*8Q8P*Ob o8oo
  dOB*9*O8P*UOpugO9*D
 CO*9O0*89PBCOPL*SOBB*
  Cgg*bU8*UO*OOd*UOdcb
    6O*U  /p  gc*U*dpP
      \\//  /d*uUP*
        \\////`}</pre>
          <pre className="trunk">{`          |||||
          |||||
   .....//||||\\....\\../\\//.....`}</pre>
        </div>
      </div>
      <div className="waves" />
    </>
  );
}

export default Scenery;

