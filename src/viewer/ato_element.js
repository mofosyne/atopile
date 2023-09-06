import { shapes, util, dia, anchors } from 'jointjs';

import { returnConfigFileName,
    concatenateParentPathAndModuleName,
    computeNameDepth,
    provideFirstNameElementFromName,
    provideLastPathElementFromPath } from './path';

import { measureText, normalizeDimensionToGrid } from './utils';

import { settings_dict } from './viewer_settings';

// Base class for the visual elements
export class AtoElement extends dia.Element {
    defaults() {
        return {
            ...super.defaults,
            instance_name: null,
            config_origin_filename: null,
            config_origin_module: [],
        };
    }

    addPortSingle(path, name, port_group_name) {
        let port_anchor = getPortLabelAnchor(port_group_name);
        this.addPort(createPort(path, name, port_group_name, port_anchor));
    }

    addPortGroup(port_group_name, port_location, port_offset, max_length) {
        let port_label_position = getPortLabelPosition(port_location);
        let port_angle = getPortLabelAngle(port_location);
        let port_list = this.getGroupPorts(port_location);
        let port_position = getPortPosition(port_location, port_list, port_offset, max_length);

        let port_group = {};

        port_group[port_group_name] = {
            position: port_position,
            attrs: {
                portBody: {
                    magnet: true,
                    r: 2,
                    fill: '#FFFFFF',
                    stroke:'#023047',
                },
            },
            label: {
                position: {
                    args: {
                        x: port_label_position[0],
                        y: port_label_position[1],
                        angle: port_angle,
                    }, // Can't use inside/outside in combination
                    //name: 'inside'
                },
                markup: [{
                    tagName: 'text',
                    selector: 'label',
                    className: 'label-text'
                }]
            },
            markup: [{
                tagName: 'circle',
                selector: 'portBody'
            }]
        };

        // Add the ports list to the element
        this.prop({"ports": { "groups": port_group}});
    }

    // TODO: need to change to add port and add pins in port
    addPortGroupWithPorts(port_group_name, port_location, pin_list) {
        this.addPortGroup(port_group_name, port_location);

        // While we are creating the port, add the pins in the element
        for (let pin of pin_list) {
            this.addPortSingle(pin['path'], pin['name'], port_group_name);
        }
    }

    resizeBasedOnContent() {
        // There are 5 rectangles that define the size of an element.
        // The four side rectangles contain the ports. The center one contains the name.
        // The left and right rectangles take the full height of the element.
        // The width of the element is equal to the left and right width + the widest of the top or bottom rectangle.
        var top_port_dim = {
            "height": 0,
            "width": 0
        };
        var bottom_port_dim = {
            "height": 0,
            "width": 0
        };
        var left_port_dim = {
            "height": 0,
            "width": 0
        };
        var right_port_dim = {
            "height": 0,
            "width": 0
        };
        var center_name_dim = {
            "height": 0,
            "width": 0
        };

        // Variable for the top and bottom ports offset from left and right edge for port creation
        var max_left_right_port_width = 0;
        // Variable used to center the top and bottom port in the center of the component
        var max_horizontal_width = 0;

        // Compute the center rectangle dimension
        center_name_dim['height'] = measureText(this['attributes']['attrs']['label']['text'], settings_dict['component']['fontSize'], "height");
        center_name_dim['height'] += settings_dict['component']['titleMargin'];
        center_name_dim['width'] = measureText(this['attributes']['attrs']['label']['text'], settings_dict['component']['fontSize'], "length");
        center_name_dim['width'] += settings_dict['component']['titleMargin'];

        let ports = this.getPorts();
        if (ports) {
            let port_buckets = {
                "top": this.getGroupPorts('top'),
                "bottom": this.getGroupPorts('bottom'),
                "left": this.getGroupPorts('left'),
                "right": this.getGroupPorts('right')
            };
            console.log(port_buckets);
            let ports_text_length = {
                "top": "",
                "bottom": "",
                "left": "",
                "right": ""
            };

            // Extract the longest port label from each bucket
            for (let port_bucket in port_buckets) {
                if (port_buckets[port_bucket].length) {
                    for (let port of port_buckets[port_bucket]) {
                        if (port["attrs"]["label"]["text"].length > ports_text_length[port_bucket].length) {
                            ports_text_length[port_bucket] = port["attrs"]["label"]["text"];
                        }
                    }
                }
            }

            top_port_dim['height'] = measureText(ports_text_length['top'], settings_dict['component']['fontSize'], "length") + settings_dict['component']['portLabelToBorderGap'];
            top_port_dim['width'] = (port_buckets['top'].length - 1) * settings_dict['component']['portPitch'];

            bottom_port_dim['height'] = measureText(ports_text_length['bottom'], settings_dict['component']['fontSize'], "length") + settings_dict['component']['portLabelToBorderGap'];
            bottom_port_dim['width'] = (port_buckets['bottom'].length - 1) * settings_dict['component']['portPitch'];

            // + 1 since we need a margin at the top and bottom
            left_port_dim['height'] = (port_buckets['left'].length) * settings_dict['component']['portPitch'];
            left_port_dim['width'] = measureText(ports_text_length['left'], settings_dict['component']['fontSize'], "length") + settings_dict['component']['portLabelToBorderGap'];

            right_port_dim['height'] = (port_buckets['right'].length) * settings_dict['component']['portPitch'];
            right_port_dim['width'] = measureText(ports_text_length['right'], settings_dict['component']['fontSize'], "length") + settings_dict['component']['portLabelToBorderGap'];
        }
        //TODO: fix this function when ports are added automatically
        let final_dim = {
            "height": 0,
            "width": 0
        };

        max_left_right_port_width = Math.max(right_port_dim['width'], left_port_dim['width']);
        max_horizontal_width = Math.max(top_port_dim['width'], bottom_port_dim['width'], center_name_dim['width']);
        var max_height = Math.max(right_port_dim['height'], left_port_dim['height'], (2 * Math.max(top_port_dim['height'], bottom_port_dim['height']) + center_name_dim['height']));

        // The width is the widest between the top, center and bottom
        final_dim['width'] = max_horizontal_width;
        final_dim['width'] += 2 * max_left_right_port_width;
        final_dim['width'] = normalizeDimensionToGrid(final_dim['width'], settings_dict['common']['gridSize']);

        final_dim['height'] = max_height;
        final_dim['height'] = normalizeDimensionToGrid(final_dim['height'], settings_dict['common']['gridSize']);

        this.resize(final_dim['width'], final_dim['height']);

        //FIXME: currently just adding a port everywhere to resize the ports
        this.addPortGroup('top', 'top', max_left_right_port_width, max_horizontal_width);
        this.addPortGroup('left', 'left', 0, max_height);
        this.addPortGroup('right', 'right', 0, max_height);
        this.addPortGroup('bottom', 'bottom', max_left_right_port_width, max_horizontal_width);
    }

    fitAncestorElements() {
        var padding = settings_dict['common']['parentPadding'];
        this.fitParent({
            deep: true,
            padding: {
                top: padding,
                left: padding,
                right: padding,
                bottom: padding
            }
        });
    }

    applyParentAttrs(attrs) {
        if ('position' in attrs) {
            // Deep setting ensures that the element is placed relative to all parents
            this.position(attrs['position']['x'], attrs['position']['y'], { deep: true });
        }
    }
}

// Class for a component
export class AtoComponent extends AtoElement {
    defaults() {
        return {
            ...super.defaults(),
            type: "AtoComponent",
            attrs: {
                body: {
                    fill: "white",
                    z: 10,
                    stroke: "black",
                    strokeWidth: settings_dict["component"]["strokeWidth"],
                    width: "calc(w)",
                    height: "calc(h)",
                    rx: 5,
                    ry: 5
                },
                label: {
                    text: "Component",
                    fill: "black",
                    fontSize: settings_dict["component"]["fontSize"],
                    fontWeight: settings_dict["component"]["fontWeight"],
                    textVerticalAnchor: "middle",
                    textAnchor: "middle",
                    fontFamily: settings_dict["common"]["fontFamily"],
                    x: "calc(w/2)",
                    y: "calc(h/2)"
                }
            }
        };
    }

    preinitialize() {
        this.markup = util.svg`
            <rect @selector="body" />
            <text @selector="label" />
        `;
    }
}

// Class for a block
// For the moment, blocks and components are separate.
// We might want to combine them in the future.
export class AtoBlock extends AtoElement {
    defaults() {
        return {
            ...super.defaults(),
            type: "AtoComponent",
            collapsed: false,
            attrs: {
                body: {
                    fill: "transparent",
                    stroke: "#333",
                    strokeWidth: settings_dict["block"]["strokeWidth"],
                    strokeDasharray: settings_dict["block"]["strokeDasharray"],
                    width: "calc(w)",
                    height: "calc(h)",
                    rx: settings_dict["block"]["boxRadius"],
                    ry: settings_dict["block"]["boxRadius"],
                },
                label: {
                    text: "Block",
                    fill: "black",
                    textVerticalAnchor: "middle",
                    fontSize: settings_dict['block']['label']['fontSize'],
                    fontWeight: settings_dict["block"]['label']["fontWeight"],
                    textAnchor: "middle",
                    fontFamily: settings_dict["common"]["fontFamily"],
                    x: 'calc(w/2)',
                    y: 'calc(h/2)'
                }
            }
        };
    }

    preinitialize() {
        this.markup = util.svg`
            <rect @selector="body" />
            <text @selector="label" />
        `;
    }

    updateChildrenVisibility() {
        const collapsed = this.isCollapsed();
        this.getEmbeddedCells().forEach((child) => child.set("hidden", collapsed));
    }
}


const cellNamespace = {
    ...shapes,
    AtoElement,
    AtoComponent,
    AtoBlock
};



function createPort(uuid, port_name, port_group_name, port_anchor) {
    return {
        id: uuid,
        group: port_group_name,
        attrs: {
            label: {
                text: port_name,
                fontFamily: settings_dict['common']['fontFamily'],
                fontSize: settings_dict['component']['pin']['fontSize'],
                fontWeight: settings_dict["component"]['pin']["fontWeight"],
                textAnchor: port_anchor,
            },
        },
        // markup: '<circle id="Oval" stroke="#000000" fill="#FFFFFF" cx="0" cy="0" r="2"/>'
    }
}

function getPortLabelPosition(location) {
    switch (location) {
        case "top":
            return [0, settings_dict['component']['portLabelToBorderGap']];
        case "bottom":
            return [0, - settings_dict['component']['portLabelToBorderGap']];
        case "left":
            return [settings_dict['component']['portLabelToBorderGap'], 0];
        case "right":
            return [- settings_dict['component']['portLabelToBorderGap'], 0];
        default:
            return [0, 0];
    };
};

function getPortLabelAnchor(location) {
    switch (location) {
        case "top":
            return 'end';
        case "bottom":
            return 'start';
        case "left":
            return 'start';
        case "right":
            return 'end';
        default:
            return 'middle';
    }
};

function getPortLabelAngle(location) {
    switch (location) {
        case "top":
            return -90;
        case "bottom":
            return -90;
        case "left":
            return 0;
        case "right":
            return 0;
        default:
            return 0;
    };
};

function getPortPosition(location, pin_list, port_offset, max_length) {
    // Make sure that the port offset results in having ports on the grid
    var center_offset = normalizeDimensionToGrid((port_offset + max_length / 2), settings_dict['common']['gridSize']);
    var port_start_position = 0;
    if ((pin_list.length / 2) % 1 == .5) {
        port_start_position = pin_list.length / 2 * settings_dict['common']['gridSize'];
    }
    else {
        port_start_position = (pin_list.length / 2 + 0.5) * settings_dict['common']['gridSize'];
    }
    var port_length = pin_list.length * settings_dict['common']['gridSize'];
    switch (location) {
        case "top":
            return {
                name: 'line',
                args: {
                    start: { x: center_offset - port_start_position, y: 0 },
                    end: { x: center_offset - port_start_position + port_length, y: 0 }
                },
            };
        case "bottom":
            return {
                name: 'line',
                args: {
                    start: { x: center_offset - port_start_position, y: 'calc(h)' },
                    end: { x: center_offset - port_start_position + port_length, y: 'calc(h)' }
                },
            };
        case "left":
            return {
                name: 'line',
                args: {
                    start: { x: 0, y: center_offset - port_start_position},
                    end: { x: 0, y: center_offset - port_start_position + port_length}
                },
            };
        case "right":
            return {
                name: 'line',
                args: {
                    start: { x: 'calc(w)', y: center_offset - port_start_position},
                    end: { x: 'calc(w)', y: center_offset - port_start_position + port_length}
                },
            };
        default:
            return 0;
    };
};


function getElementTitle(element) {
    if (element['instance_of'] != null) {
        return`${element['name']} \n(${provideLastPathElementFromPath(element['instance_of']).name})`;
    } else {
        return element['name'];;
    }
}

function addPins(jointJSObject, element, path) {
    // Create the default port location
    let ports_to_add = {};

    // Create the ports that are defined in the config
    for (let port of ((element.config || {}).ports || [])) {
        ports_to_add[(port.name || "top")] = {
            "location": (port.location || "top"),
            "pins": []
        }
    }

    let config_found;
    for (let pin_to_add of element['pins']) {

        pin_to_add['path'] = concatenateParentPathAndModuleName(path, pin_to_add['name']);

        config_found = false;
        for (let config_pin of ((element.config || {}).pins || [])) {
            // If a port is defined, add it to it designated port
            if (pin_to_add['name'] == config_pin['name']) {
                ports_to_add[config_pin['port']]['pins'].push(pin_to_add);
                config_found = true;
            }
        }
        // If no port is defined, add it to the default port
        if (!config_found) {
            if (!ports_to_add['top']) ports_to_add['top'] = {"location": "top", "pins": []};
            ports_to_add['top']['pins'].push(pin_to_add);
        }
    }

    for (let port in ports_to_add) {
        if (ports_to_add[port]['pins'].length > 0) {
            jointJSObject.addPortGroupWithPorts(port, ports_to_add[port]['location'], ports_to_add[port]['pins']);
        }
    }
}

export function createComponent(element, parent, path) {
    let title = getElementTitle(element);
    var component = new AtoComponent({
        id: path,
        instance_name: element['name'],
        size: { width: 10,
                height: 10},
        attrs: {
            label: {
                text: title,
            }
        },
        config_origin_filename: element.config_origin_filename,
        config_origin_module: element.config_origin_module,
    });

    addPins(component, element, path);
    component.resizeBasedOnContent();

    return component;
}

export function createBlock(element, parent, path) {
    let title = getElementTitle(element);
    let block = new AtoBlock({
        id: path,
        instance_name: element['name'],
        size: {
            width: 200,
            height: 100
        },
        attrs: {
            label: {
                text: title,
            }
        },
        config_origin_filename: element.config_origin_filename,
        config_origin_module: element.config_origin_module,
    });

    addPins(block, element, path);

    return block;
}


function addStub(block_id, port_id, label) {
    let added_stub = new shapes.standard.Link({
        source: {
            id: block_id,
            port: port_id,
            anchor: {
                name: 'center'
            }
        },
            target: {
            id: block_id,
            port: port_id,
            anchor: {
                name: 'customAnchor'
            },
            connectionPoint: {
                name: 'anchor'
            }
        }
    });
    added_stub.attr({
        line: {
            'stroke': settings_dict['link']['color'],
            'stroke-width': settings_dict['link']['strokeWidth'],
            targetMarker: {'type': 'none'},
        },
        z: 0,
    });
    added_stub.appendLabel({
        attrs: {
            text: {
                text: label,
                fontFamily: settings_dict['common']['fontFamily'],
                fontSize: settings_dict['stubs']['fontSize'],
                //textVerticalAnchor: "middle",
                textAnchor: "middle",
            }
        },
        position: {
            distance: .9,
            offset: -5,
            angle: 0,
            args: {
                keepGradient: true,
                ensureLegibility: true,
            }
        }
    });

    return added_stub;
}

function addLink(source_block_id, source_port_id, target_block_id, target_port_id) {
    var added_link = new shapes.standard.Link({
        source: {
            id: source_block_id,
            port: source_port_id
        },
        target: {
            id: target_block_id,
            port: target_port_id
        }
    });
    added_link.attr({
        line: {
            'stroke': settings_dict['link']['color'],
            'stroke-width': settings_dict['link']['strokeWidth'],
            targetMarker: {'type': 'none'},
        },
        z: 0
    });
    added_link.router('manhattan', {
        perpendicular: true,
        step: settings_dict['common']['gridSize'],
    });

    return added_link;
}

// Return the cell id and port id from port name and current path
// If the link spans deeper than one module, a port is added to the module
// TODO: what happens if the port is multiple layers deep?
// TODO: Currently only adding the top link
function getLinkAddress(port, current_path, embedded_cells) {
    let port_path = concatenateParentPathAndModuleName(current_path, port);
    let port_name_depth = computeNameDepth(port);
    let cell_id;
    let first_element;

    switch (port_name_depth) {
        case 1:
            cell_id = current_path;
            break;
        case 2:
            first_element = provideFirstNameElementFromName(port);
            cell_id = concatenateParentPathAndModuleName(current_path, first_element['first_name']);
            break;
        default:
            first_element = provideFirstNameElementFromName(port);
            cell_id = concatenateParentPathAndModuleName(current_path, first_element['first_name']);
            for (let cell of embedded_cells) {
                if (cell['id'] == cell_id) {
                    cell.addPortSingle(port_path, first_element['remaining'], 'bottom');
                    cell.resizeBasedOnContent();
                }
            }
            break;
    }
    return {'cell_id': cell_id, 'port_id': port_path};
}


export function addLinks(element, current_path, embedded_cells) {
    let added_elements = [];
    for (let link of element['links']) {
        let source_address = getLinkAddress(link['source'], current_path, embedded_cells);
        let target_address = getLinkAddress(link['target'], current_path, embedded_cells);

        let is_stub = false;
        for (let link_config of ((element.config || {}).signals || [])) {
            if (link_config['name'] == link['name'] && link_config['is_stub']) {
                is_stub = true;
                // if not a module (don't want stubs at module level)
                if (current_path.length != source_address['cell_id'].length) {
                    added_elements.push(addStub(source_address['cell_id'], source_address['port_id'], link['name']));
                }
                // if not a module (don;t want stubs at module level)
                if (current_path.length != target_address['cell_id'].length) {
                    added_elements.push(addStub(target_address['cell_id'], target_address['port_id'], link['name']));
                }
            }
        }
        if (!is_stub) {
            added_elements.push(addLink(source_address['cell_id'], source_address['port_id'], target_address['cell_id'], target_address['port_id']));
        }
    }

    return added_elements;
}

export function customAnchor(view, magnet, ref, opt, endType, linkView) {
    const elBBox = view.model.getBBox();
    const magnetCenter = view.getNodeBBox(magnet).center();
    const side = elBBox.sideNearestToPoint(magnetCenter);
    let dx = 0;
    let dy = 0;
    const length = ('length' in opt) ? opt.length : 30;
    switch (side) {
        case 'left':
        dx = -length;
        break;
        case 'right':
        dx = length;
        break;
        case 'top':
        dy = -length;
        break;
        case 'bottom':
        dy = length;
        break;

    }
    return anchors.center.call(this, view, magnet, ref, {
      ...opt,
      dx,
      dy
    }, endType, linkView);
}