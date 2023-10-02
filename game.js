var game;

const PLAYER_CATEGORY = 0x0002;
const PLAYER_MASK = 0x0001;
const OPPONENT_CATEGORY = 0x0004;
const OPPONENT_MASK = 0x0001;

var gameOptions = {
  startTerrainHeight: 0.5,
  amplitude: 100,
  slopeLength: [150, 350],
  mountainsAmount: 3,
  slopesPerMountain: 10,
  carAcceleration: 0.01,
  maxCarVelocity: 1,
};

var numPer = 0;
var conn;
var peerjsConnectionG = [];
var player = "X";

var slopePointsP = [];
var pointXP = [];
var start = false;

var opponentCarCoord;
var opponentCarAtt;

var peerjsPeer = new Peer({
  host: "0.peerjs.com",
  port: "",
});

peerjsPeer.on("open", function () {
  if (!location.hash || location.search.includes("single")) {
    location.hash = peerjsPeer.id;
    single = true;
  } else {
    single = true;
    connect(location.hash.substring(1));
  }
});

function connect(ID) {
  var peerID = ID;
  var aux = numPer;
  conn = peerjsPeer.connect(peerID);
  conn.on("open", function () {
    player = 0;
    conn.on("data", function (data) {
      console.log("conn", data);
      if (data?.start) {
        slopePointsP = JSON.parse(data?.slopePointsP);
        pointXP = JSON.parse(data?.pointXP);
        start = true;
      } else {
        opponentCarAtt = true;
        opponentCarCoord = {
          x: JSON.parse(data?.opponentCarX),
          y: JSON.parse(data?.opponentCarY),
        };
      }
    });
  });
}

peerjsPeer.on("connection", function (peerjsConnection) {
  peerjsConnectionG[numPer] = peerjsConnection;
  peerjsConnection.on("open", function () {
    peerjsConnection.send({
      pointXP: JSON.stringify(pointXP),
      slopePointsP: JSON.stringify(slopePointsP),
      start: true,
    });
    player = numPer + 1;
  });
  peerjsConnection.on("data", function (data) {
    console.log("peerjsConnection", data);
    opponentCarAtt = true;
    opponentCarCoord = {
      x: JSON.parse(data?.opponentCarX),
      y: JSON.parse(data?.opponentCarY),
    };
  });
});

function startPhaserGame() {
  let gameConfig = {
    type: Phaser.AUTO,
    backgroundColor: 0x75d5e3,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      parent: "thegame",
      width: 1334,
      height: 750,
    },
    physics: {
      default: "matter",
      matter: {
        debug: true,
        debugBodyColor: 0x000000,
      },
    },
    scene: playGame,
  };
  game = new Phaser.Game(gameConfig);
}

class playGame extends Phaser.Scene {
  constructor() {
    super("PlayGame");
  }

  create() {
    this.camMove = true;
    this.alive = true;
    this.gameOpen = true;
    this.bodyPool = [];
    this.bodyPoolId = [];
    this.mountainGraphics = [];
    this.mountainStart = new Phaser.Math.Vector2(0, 0);

    if (peerjsConnectionG[numPer]) {
      for (let i = 0; i < gameOptions.mountainsAmount; i++) {
        this.mountainGraphics[i] = this.add.graphics();
        this.mountainStart = this.generateTerrain(
          this.mountainGraphics[i],
          this.mountainStart,
          i
        );
      }
    } else {
      for (let i = 0; i < gameOptions.mountainsAmount; i++) {
        this.mountainGraphics[i] = this.add.graphics();
        this.mountainStart = this.generateTerrain(
          this.mountainGraphics[i],
          this.mountainStart,
          i,
          slopePointsP[i],
          pointXP[i]
        );
      }
    }

    this.addCar(250, 300);
    this.addOpponentCar(250, 300);

    this.isAccelerating = false;

    this.input.on("pointerdown", this.accelerate, this);
    this.input.on("pointerup", this.decelerate, this);

    this.terrainInfo = this.add.text(0, game.config.height - 110, "", {
      fontFamily: "Arial",
      fontSize: 64,
      color: "#00ff00",
    });

    this.info = this.add.text(0, game.config.height - 270, "", {
      fontFamily: "Arial",
      fontSize: 124,
      color: "#ff0f",
    });

    this.matter.world.on(
      "collisionstart",
      function (event, bodyA, bodyB) {
        if (
          (bodyA.label == "pista" && bodyB.label == "diamond") ||
          (bodyB.label == "pista" && bodyA.label == "diamond")
        ) {
          this.alive = false;
          this.time.delayedCall(2000, this.restartGame, [], this);
        }
      }.bind(this)
    );

    this.pressText = this.add.text(
      game.config.width / 2,
      game.config.height - 190,
      "Press para começar",
      {
        fontFamily: "Arial",
        fontSize: 64,
        color: "#ffffff",
        align: "center",
      }
    );
    this.pressText.setOrigin(0.5);
    this.click = true;
  }
  onPointerDown() {
    if (this.click) {
      this.pressText.destroy();
      if (!(peerjsConnectionG[numPer] || conn)) {
        this.startOpponentCarMovement();
      }
    }
  }
  generateTerrain(
    graphics,
    mountainStart,
    index = 0,
    slopePoints = [],
    pointX = 0
  ) {
    let slopeStart = new Phaser.Math.Vector2(0, mountainStart.y);
    let slopes = 0;

    if (slopePoints.length == 0) {
      let slopeLength = Phaser.Math.Between(
        gameOptions.slopeLength[0],
        gameOptions.slopeLength[1]
      );
      let slopeEnd =
        mountainStart.x == 0
          ? new Phaser.Math.Vector2(
              slopeStart.x + gameOptions.slopeLength[1] * 1.5,
              0
            )
          : new Phaser.Math.Vector2(slopeStart.x + slopeLength, Math.random());
      while (slopes < gameOptions.slopesPerMountain) {
        let interpolationVal = this.interpolate(
          slopeStart.y,
          slopeEnd.y,
          (pointX - slopeStart.x) / (slopeEnd.x - slopeStart.x)
        );

        if (pointX == slopeEnd.x) {
          slopes++;
          slopeStart = new Phaser.Math.Vector2(pointX, slopeEnd.y);
          slopeEnd = new Phaser.Math.Vector2(
            slopeEnd.x +
              Phaser.Math.Between(
                gameOptions.slopeLength[0],
                gameOptions.slopeLength[1]
              ),
            Math.random()
          );
          interpolationVal = slopeStart.y;
        }

        let pointY =
          game.config.height * gameOptions.startTerrainHeight +
          interpolationVal * gameOptions.amplitude;
        slopePoints.push(new Phaser.Math.Vector2(pointX, pointY));
        pointX++;
      }
    }
    let simpleSlope = this.simplify(slopePoints, 1, true);
    graphics.x = mountainStart.x;
    graphics.clear();
    graphics.moveTo(0, game.config.height);
    graphics.fillStyle(0x654b35);
    graphics.beginPath();
    simpleSlope.forEach(function (point) {
      graphics.lineTo(point.x, point.y);
    });
    graphics.lineTo(pointX, game.config.height);
    graphics.lineTo(0, game.config.height);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(16, 0x6b9b1e);
    graphics.beginPath();
    simpleSlope.forEach(function (point) {
      graphics.lineTo(point.x, point.y);
    });
    graphics.strokePath();

    for (let i = 1; i < simpleSlope.length; i++) {
      let line = new Phaser.Geom.Line(
        simpleSlope[i - 1].x,
        simpleSlope[i - 1].y,
        simpleSlope[i].x,
        simpleSlope[i].y
      );
      let distance = Phaser.Geom.Line.Length(line);
      let center = Phaser.Geom.Line.GetPoint(line, 0.5);
      let angle = Phaser.Geom.Line.Angle(line);

      if (this.bodyPool.length == 0) {
        this.matter.add.rectangle(
          center.x + mountainStart.x,
          center.y,
          distance,
          10,
          {
            label: "pista",
            isStatic: true,
            angle: angle,
            friction: 1,
            restitution: 0,
            collisionFilter: {
              category: 11,
              mask: 11,
            },
          }
        );
      } else {
        let body = this.bodyPool.shift();
        this.bodyPoolId.shift();
        this.matter.body.setPosition(body, {
          x: center.x + mountainStart.x,
          y: center.y,
        });
        let length = body.area / 10;
        this.matter.body.setAngle(body, 0);
        this.matter.body.scale(body, 1 / length, 1);
        this.matter.body.scale(body, distance, 1);
        this.matter.body.setAngle(body, angle);
      }
    }

    graphics.width = pointX - 1;
    pointXP[index] = pointX;
    slopePointsP[index] = slopePoints;
    return new Phaser.Math.Vector2(graphics.x + pointX - 1, slopeStart.y);
  }

  startOpponentCarMovement() {
    const movementInterval = 100;
    const opponentCarSpeed = 0.22;
    this.time.addEvent({
      delay: movementInterval,
      loop: true,
      callback: () => {
        if (this.opponentFrontWheel && this.opponentRearWheel) {
          this.matter.body.setAngularVelocity(
            this.opponentFrontWheel,
            opponentCarSpeed
          );
          this.matter.body.setAngularVelocity(
            this.opponentRearWheel,
            opponentCarSpeed
          );
        }
      },
    });
  }

  addCar(posX, posY) {
    const rampVertices = [
      { x: -50, y: 0 },
      { x: -50, y: -30 },
      { x: -40, y: -15 },
      { x: 40, y: -15 },
      { x: 50, y: -30 },
      { x: 50, y: 0 },
    ];
    const diamondInitialX = posX;
    const diamondInitialY = posY - 80;

    this.diamond = this.matter.add.rectangle(
      diamondInitialX,
      diamondInitialY,
      30,
      30,
      {
        friction: 1,
        restitution: 0,
        label: "diamond",
        collisionFilter: {
          category: 1,
          mask: PLAYER_CATEGORY,
        },
      }
    );

    this.body = this.matter.add.fromVertices(posX, posY, rampVertices, {
      friction: 1,
      restitution: 0,
      label: "car",
      collisionFilter: {
        category: PLAYER_CATEGORY,
        mask: PLAYER_MASK,
      },
    });

    this.bodyCarGraphics = this.add.graphics({
      lineStyle: { width: 3, color: 0xff0000 },
    });
    this.bodyCarGraphics.strokePoints(rampVertices, true);
    this.add.existing(this.bodyCarGraphics);

    this.frontWheel = this.matter.add.circle(posX + 35, posY + 25, 30, {
      friction: 1,
      restitution: 0,
      collisionFilter: {
        category: PLAYER_CATEGORY,
        mask: PLAYER_MASK,
      },
    });

    this.rearWheel = this.matter.add.circle(posX - 35, posY + 25, 30, {
      friction: 1,
      restitution: 0,
      collisionFilter: {
        category: PLAYER_CATEGORY,
        mask: PLAYER_MASK,
      },
    });

    this.matter.add.constraint(this.body, this.frontWheel, 40, 0, {
      pointA: {
        x: 30,
        y: 10,
      },
    });

    this.matter.add.constraint(this.body, this.frontWheel, 40, 0, {
      pointA: {
        x: 45,
        y: 10,
      },
    });

    this.matter.add.constraint(this.body, this.rearWheel, 40, 0, {
      pointA: {
        x: -30,
        y: 10,
      },
    });

    this.matter.add.constraint(this.body, this.rearWheel, 40, 0, {
      pointA: {
        x: -45,
        y: 10,
      },
    });

    this.playerText = this.add.text(posX, posY - 60, "Você", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      align: "center",
    });
    this.playerText.setOrigin(0.5);
  }

  addOpponentCar(posX, posY) {
    if (this.opponentCarBody) {
      this.matter.world.remove(this.opponentCarBody); // Remova o corpo do carro do adversário existente
      this.matter.world.remove(this.opponentFrontWheel); // Remova a roda dianteira do adversário existente
      this.matter.world.remove(this.opponentRearWheel); // Remova a roda traseira do adversário existente

      this.matter.world.removeConstraint(this.constraintOpponentA);
      this.matter.world.removeConstraint(this.constraintOpponentB);
      this.matter.world.removeConstraint(this.constraintOpponentC);
      this.matter.world.removeConstraint(this.constraintOpponentD);
    }

    let floor = Phaser.Physics.Matter.Matter.Bodies.rectangle(
      posX,
      posY,
      100,
      10,
      {
        label: "opponentCar",
      }
    );
    let rightBarrier = Phaser.Physics.Matter.Matter.Bodies.rectangle(
      posX + 45,
      posY - 10,
      10,
      20,
      {
        label: "opponentCar",
      }
    );
    let leftBarrier = Phaser.Physics.Matter.Matter.Bodies.rectangle(
      posX - 45,
      posY - 10,
      10,
      20,
      {
        label: "opponentCar",
      }
    );

    this.opponentCarBody = Phaser.Physics.Matter.Matter.Body.create({
      parts: [floor, leftBarrier, rightBarrier],
      friction: 1,
      restitution: 0,
      collisionFilter: {
        category: OPPONENT_MASK,
        mask: OPPONENT_MASK,
      },
    });

    this.matter.world.add(this.opponentCarBody);

    this.opponentFrontWheel = this.matter.add.circle(posX + 35, posY + 50, 30, {
      friction: 1,
      restitution: 0,
      collisionFilter: {
        category: PLAYER_CATEGORY,
        mask: OPPONENT_MASK,
      },
    });

    this.opponentRearWheel = this.matter.add.circle(posX - 35, posY + 50, 30, {
      friction: 1,
      restitution: 0,
      collisionFilter: {
        category: PLAYER_CATEGORY,
        mask: OPPONENT_MASK,
      },
    });

    this.constraintOpponentA = this.matter.add.constraint(
      this.opponentCarBody,
      this.opponentFrontWheel,
      40,
      0,
      {
        pointA: {
          x: 30,
          y: 10,
        },
      }
    );

    this.constraintOpponentB = this.matter.add.constraint(
      this.opponentCarBody,
      this.opponentFrontWheel,
      40,
      0,
      {
        pointA: {
          x: 45,
          y: 10,
        },
      }
    );

    this.constraintOpponentC = this.matter.add.constraint(
      this.opponentCarBody,
      this.opponentRearWheel,
      40,
      0,
      {
        pointA: {
          x: -30,
          y: 10,
        },
      }
    );

    this.constraintOpponentD = this.matter.add.constraint(
      this.opponentCarBody,
      this.opponentRearWheel,
      40,
      0,
      {
        pointA: {
          x: -45,
          y: 10,
        },
      }
    );
  }

  accelerate() {
    this.onPointerDown();
    this.isAccelerating = true;
  }

  decelerate() {
    this.isAccelerating = false;
  }

  update() {
    if (peerjsConnectionG[numPer]) {
      peerjsConnectionG[numPer].send({
        opponentCarX: JSON.stringify(this.body.position.x),
        opponentCarY: JSON.stringify(this.body.position.y),
        start: false,
      });
    } else if (conn) {
      conn.send({
        opponentCarX: JSON.stringify(this.body.position.x),
        opponentCarY: JSON.stringify(this.body.position.y),
        start: false,
      });
    }

    if (opponentCarAtt) {
      opponentCarAtt = false;
      this.addOpponentCar(opponentCarCoord.x, opponentCarCoord.y);
    }
    this.bodyCarGraphics.x = this.body.position.x;
    this.bodyCarGraphics.y = this.body.position.y + 9;
    this.bodyCarGraphics.rotation = this.body.angle;

    if (this.camMove)
      this.cameras.main.scrollX = this.body.position.x - game.config.width / 8;

    if (this.isAccelerating && this.alive) {
      let velocity = this.frontWheel.angularSpeed + gameOptions.carAcceleration;
      velocity = Phaser.Math.Clamp(velocity, 0, gameOptions.maxCarVelocity);
      this.matter.body.setAngularVelocity(this.frontWheel, velocity);
      this.matter.body.setAngularVelocity(this.rearWheel, velocity);
    }

    let bodies = this.matter.world.localWorld.bodies;

    bodies.forEach(
      function (body) {
        if (
          this.cameras.main.scrollX > body.position.x + game.config.width &&
          this.bodyPoolId.indexOf(body.id) == -1
        ) {
          this.bodyPool.push(body);
          this.bodyPoolId.push(body.id);
        }
      }.bind(this)
    );
    if (!this.alive) {
      this.decelerate();
      this.info.x = this.cameras.main.scrollX + 100;
      this.info.setText("A encomenda caiu");
    }

    if (start) {
      start = false;
      this.restartGame();
    }

    this.terrainInfo.x = this.cameras.main.scrollX + 50;
    this.terrainInfo.setText(
      "Você: " + Math.floor(this.cameras.main.scrollX / 100)
    );

    this.playerText.x = this.body.position.x;
    this.playerText.y = this.body.position.y - 60;

    if (
      (this.cameras.main.scrollX >
        this.mountainGraphics[this.mountainGraphics.length - 1].x +
          this.mountainGraphics[this.mountainGraphics.length - 1].width ||
        this.opponentCarBody.position.x >
          this.mountainGraphics[this.mountainGraphics.length - 1].x +
            this.mountainGraphics[this.mountainGraphics.length - 1].width) &&
      this.gameOpen &&
      this.alive
    ) {
      this.gameOpen = false;
      this.camMove = false;
      this.info.x = this.cameras.main.scrollX + 300;
      if (this.opponentCarBody.position.x > this.body.position.x) {
        this.info.setText("Você Perdeu");
      } else {
        this.info.setText("Você Venceu");
      }
      this.time.delayedCall(2500, this.restartGame, [], this);
    }
  }

  restartGame() {
    this.scene.restart();
  }

  interpolate(vFrom, vTo, delta) {
    let interpolation = (1 - Math.cos(delta * Math.PI)) * 0.5;
    return vFrom * (1 - interpolation) + vTo * interpolation;
  }

  simplify(points, tolerance, highestQuality) {
    if (points.length <= 2) return points;

    let sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

    points = highestQuality
      ? points
      : this.simplifyRadialDistance(points, sqTolerance);
    points = this.simplifyDouglasPeucker(points, sqTolerance);

    return points;
  }

  simplifyRadialDistance(points, sqTolerance) {
    let prevPoint = points[0];
    let newPoints = [prevPoint];
    let point;

    for (let i = 1, len = points.length; i < len; i++) {
      point = points[i];

      if (this.sqDist(point, prevPoint) > sqTolerance) {
        newPoints.push(point);
        prevPoint = point;
      }
    }

    if (prevPoint !== point) newPoints.push(point);

    return newPoints;
  }

  simplifyDouglasPeucker(points, sqTolerance) {
    let len = points.length;
    let MarkerArray = typeof Uint8Array !== undefined + "" ? Uint8Array : Array;
    let markers = new MarkerArray(len);
    let first = 0;
    let last = len - 1;
    let stack = [];
    let newPoints = [];
    let maxSqDist;
    let sqDist;
    let index;

    markers[first] = markers[last] = 1;

    while (last) {
      maxSqDist = 0;

      for (let i = first + 1; i < last; i++) {
        sqDist = this.sqClosestPointOnSegment(
          points[i],
          points[first],
          points[last]
        );

        if (sqDist > maxSqDist) {
          index = i;
          maxSqDist = sqDist;
        }
      }

      if (maxSqDist > sqTolerance) {
        markers[index] = 1;
        stack.push(first, index, index, last);
      }

      last = stack.pop();
      first = stack.pop();
    }

    for (let i = 0; i < len; i++) {
      if (markers[i]) newPoints.push(points[i]);
    }

    return newPoints;
  }

  sqDist(p1, p2) {
    let dx = p1.x - p2.x,
      dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  }

  sqClosestPointOnSegment(p, p1, p2) {
    let x = p1.x,
      y = p1.y,
      dx = p2.x - x,
      dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
      let t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = p.x - x;
    dy = p.y - y;

    return dx * dx + dy * dy;
  }
}

startPhaserGame();
