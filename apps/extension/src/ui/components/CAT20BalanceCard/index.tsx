import { CAT20BalanceCardProps, useCAT20BalanceCardLogic } from '@unisat/wallet-state';
import { Card } from '../Card';
import { Row } from '../Row';
import { RunesTicker } from '../RunesTicker';
import { Text } from '../Text';
import { getTokenBalanceCardStyle, TokenBalanceCardLayout } from '../TokenBalanceCardLayout';
import { TokenBalanceIcon } from '../TokenBalanceIcon';

export function CAT20BalanceCard(props: CAT20BalanceCardProps) {
  const { tokenBalance, balance, balanceStr, onClick, showPrice, price, iconInfo } = useCAT20BalanceCardLogic(props);

  return (
    <Card
      fullX
      onClick={() => {
        onClick && onClick();
      }}
      style={getTokenBalanceCardStyle()}>
      <TokenBalanceCardLayout
        icon={<TokenBalanceIcon iconInfo={iconInfo} />}
        onIconClick={onClick}
        title={<RunesTicker tick={tokenBalance.name} />}
        quantity={
          <Row itemsCenter gap="zero">
            <Text text={balanceStr} size="xs" />
            <Text text={tokenBalance.symbol} size="xs" mx="sm" />
          </Row>
        }
        showPrice={showPrice}
        price={price}
        balance={balance.toString()}
      />
    </Card>
  );
}
