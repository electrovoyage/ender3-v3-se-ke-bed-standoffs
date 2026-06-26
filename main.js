import { createOpenSCAD } from "./node_modules/openscad-wasm/openscad.js";

async function createStandoff(right, front, levelling_offset, resolution, number) {
    const filename = `${number}-standoff-${front ? "front" : "back"}-${right ? "right" : "left"}.stl`;

    const openscad = await createOpenSCAD();
    const instance = openscad.getInstance();

    // Write a file to the filesystem
    instance.FS.writeFile("/input.scad", `
        $fn = ${resolution};

        right = ${right};
        front = ${front};

        // this offset is applied with an inverted sign
        levelling_offset = 0;

        // standoffs on the right are slightly taller
        baseheight = right ? 16 : 14;

        trueheight = baseheight - levelling_offset;

        number = (right ? 2 : 0) + (front ? 2 : 1);
        internal_diameter = 4.5;
        external_diameter = 8;

        difference() {
            difference() {
                cylinder(trueheight, external_diameter / 2, external_diameter / 2, center=true);
                cylinder(trueheight+1, internal_diameter / 2, internal_diameter / 2, center=true);
            }

            deltaangle = 360 / number;

            for (i = [0:number-1]) {
                rotate([0, 0, deltaangle * i]) {
                    translate([3, 0, 0]) {
                        cube([5, 1, trueheight - 10], center=true);
                    }
                }
            }
        }
    `);

    // Run like a command-line program with arguments
    instance.callMain(["/input.scad", "-o", filename]); // manifold is faster at rendering

    // Read the output 3D-model into a JS byte-array
    const output = instance.FS.readFile("/"+filename);

    // Generate a link to output 3D-model and download the output STL file
    
    return [filename, output];
}

window.onload = () => {
    const levellingBox = document.querySelector('.levelling-grid');

    for (let i = 0; i < 16; i++) {
        let newElement = document.createElement('div');

        // if a corner
        if (i == 0 || i == 3 || i == 12 || i == 15) {
            let class_postfix = i == 0 ? "top-left"
                : (i == 3 ? "top-right"
                    : (i == 12 ? "bottom-left"
                        : "bottom-right")
                );

            newElement.style.cssText = `border: 2px solid var(--levelling-${class_postfix}); display: flex; justify-content: left; align-items: center; padding-left: 5px;`;
            let inputField = document.createElement('input');

            inputField.style.cssText = "width: 80%; height: 90%; box-sizing: border-box; border: 0px;"

            inputField.setAttribute('type', 'number');
            inputField.setAttribute('min', '-5')
            inputField.setAttribute('max', '5')
            inputField.setAttribute('step', '0.01')
            inputField.setAttribute('value', '0.00')

            inputField.setAttribute('class',`levelling-${class_postfix}`);
            inputField.addEventListener('input', (event) => {
                let value = event.target.value;
                document.documentElement.style.setProperty(`--levelling-${class_postfix}`,
                    Math.abs(value) <= 0.49 ? "green" : (
                            Math.abs(value) <= 0.99 ? "blue" : (
                                Math.abs(value) <= 1.99 ? "yellow" : "red"
                            )))
            })

            let column = i % 4 / 3;
            let row = Math.trunc(i / 4) / 3;
            let numberLabel = document.createElement('p');
            let cornerindices = [[1, 3], [2, 4]];
            numberLabel.innerHTML = cornerindices[row][column];
            numberLabel.style.cssText = `color: white; background-color: var(--levelling-${class_postfix}); height: 100%; margin-left: auto; padding: 5px; box-sizing: border-box; align-content: center;`

            newElement.appendChild(inputField);
            newElement.appendChild(numberLabel);
        } else {
            newElement.style.cssText = 'border: 2px dotted black;';
        }

        levellingBox.appendChild(newElement);
    }
}

const generateButton = document.querySelector('.generate');
    
generateButton.addEventListener('click', async function () {
    generateButton.disabled = true;

    let resolutionField = document.querySelector('.resolution-field');
    let resolution = resolutionField.value;

    const zip = new JSZip();

    for (let i = 0; i < 4; i++) {
        let back = i % 2 == 0;
        let left = i < 2;
        let field = document.querySelector(`.levelling-${back ? "top" : "bottom"}-${left ? "left" : "right"}`);
        let value = field.value;

        let [filename, content] = await createStandoff(!left, !back, value, resolution, i);
        zip.file(filename, content);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(
    new Blob([zipBlob], { type: "application/octet-stream" }), null);
    link.download = 'my-standoffs.zip';

    document.body.append(link);

    link.click();
    link.remove();
    generateButton.disabled = false;
})