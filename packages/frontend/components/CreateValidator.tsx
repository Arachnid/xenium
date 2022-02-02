import { useEthers } from "@usedapp/core";
import { Radio } from "antd";
import { NextPage } from "next";
import { useState } from "react";
import CreateERC20UniqueNonceValidator from "./factories/CreateERC20UniqueNonceValidator";
import { Factory } from "./factories/IFactory";

const FACTORIES: {[key: string]: {name: string, component: Factory}} = {
  "0x4c6e8825e9c914d512d61e65ebc25431d816212c": {
      name: "ERC20UniqueNonceValidator",
      component: CreateERC20UniqueNonceValidator
  }
};

const CreateValidator: NextPage = () => {
  const options = Object.entries(FACTORIES).map(
    ([addr, data]) => ({label: data.name, value: addr}));
  const [selected, setSelected] = useState(options[0].value);

  const onSubmit = () => {
    console.log("Submitted");
  };

  const Component = FACTORIES[selected].component;
  
  return (<>
    <Radio.Group options={options} value={selected} optionType="button" buttonStyle="solid" />
    <Component issuers={[]} onSubmit={onSubmit} factory={selected} />
  </>);
}

export default CreateValidator;